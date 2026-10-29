import assert from "node:assert/strict";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { createServer } from "node:http";
import test from "node:test";
import LearningGoal from "../src/models/LearningGoal.ts";
import LearningProgress from "../src/models/LearningProgress.ts";
import User from "../src/models/User.ts";
import { createProfileRouter } from "../src/routes/profile.ts";
import { validateProfileUpdate } from "../src/profileValidation.ts";
import {
  createApiJsonParser,
  createProfilePhotoBodyParser,
} from "../src/requestBodyParsing.ts";

const sessionSecret = "test-only-profile-route-secret-with-32-bytes";
const authenticatedUserId = "507f1f77bcf86cd799439011";
const otherUserId = "507f191e810c19729de860ea";
const origin = "http://localhost:5173";

function createProfileDocument(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(authenticatedUserId),
    name: "Ada Lovelace",
    email: "ada@example.com",
    avatar: "https://example.com/google-avatar.png",
    username: "ada_codes",
    displayName: "",
    bio: "",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    preferredLanguage: "cpp",
    learningLevel: "beginner",
    editorFontSize: 13,
    customAvatarId: undefined,
    save: async () => {},
    ...overrides,
  };
}

async function createProfileServer(
  context,
  profile,
  findById = async (userId) => {
    profile.requestedUserId = userId;
    return profile;
  },
) {
  context.mock.method(User, "exists", async () => ({ _id: authenticatedUserId }));
  context.mock.method(User, "findById", findById);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/profile",
    createProfileRouter({
      allowedOrigins: new Set([origin]),
      sessionSecret,
      isProduction: false,
      sameSite: "lax",
    }),
  );
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const token = jwt.sign({}, sessionSecret, {
    algorithm: "HS256",
    subject: authenticatedUserId,
    issuer: "algocanvas",
    audience: "algocanvas-web",
    expiresIn: "1h",
  });
  return {
    url: `http://127.0.0.1:${address.port}/api/profile`,
    headers: {
      Cookie: `algocanvas_session=${token}`,
      Origin: origin,
      "Content-Type": "application/json",
    },
  };
}

test("profile schema has a unique sparse username index for existing accounts", () => {
  const usernameIndex = User.schema.indexes().find(
    ([fields, options]) => fields.username === 1 && options.unique && options.sparse,
  );
  assert.ok(usernameIndex);
});

test("a 122,391-byte JPEG reaches the raw avatar parser without the 16 KB JSON limit", async (context) => {
  const app = express();
  app.use(createApiJsonParser());
  app.use("/api/profile/avatar", ...createProfilePhotoBodyParser());
  app.post("/api/profile/avatar", (req, res) => {
    const bytes = req.body;
    res.json({
      size: bytes.length,
      signature: bytes.subarray(0, 3).toString("hex"),
    });
  });
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const jpeg = Buffer.alloc(122391);
  jpeg.set([0xff, 0xd8, 0xff]);
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/profile/avatar`,
    {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: jpeg,
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    size: 122391,
    signature: "ffd8ff",
  });

  const oversized = await fetch(
    `http://127.0.0.1:${address.port}/api/profile/avatar`,
    {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: Buffer.alloc(5 * 1024 * 1024 + 1),
    },
  );
  assert.equal(oversized.status, 413);
  assert.deepEqual(await oversized.json(), {
    message: "Profile photos must be 5 MB or smaller.",
  });
});

test("profile validation trims fields and rejects arbitrary database updates", () => {
  const valid = validateProfileUpdate({
    name: "  Ada Lovelace ",
    username: "ADA_CODES",
    displayName: "  Ada ",
    bio: "  Learning algorithms ",
    preferredLanguage: "python",
    learningLevel: "intermediate",
    editorFontSize: 16,
  });
  assert.deepEqual(valid, {
    update: {
      name: "Ada Lovelace",
      username: "ada_codes",
      displayName: "Ada",
      bio: "Learning algorithms",
      preferredLanguage: "python",
      learningLevel: "intermediate",
      editorFontSize: 16,
    },
  });
  assert.match(
    validateProfileUpdate({ ...valid.update, $set: { role: "admin" } }).error,
    /unsupported fields/,
  );
  assert.match(
    validateProfileUpdate({ ...valid.update, username: "a" }).error,
    /Username/,
  );
});

test("profile reads and updates use only the verified session identity", async (context) => {
  const profile = createProfileDocument();
  const { url, headers } = await createProfileServer(context, profile);

  const response = await fetch(`${url}?userId=${otherUserId}`, { headers });
  assert.equal(response.status, 200);
  assert.equal(profile.requestedUserId, authenticatedUserId);
  const body = await response.json();
  assert.equal(body.profile.email, "ada@example.com");
  assert.equal(body.profile.authMethod, "Google");
  assert.equal(body.profile.preferences.editorFontSize, 13);

  const updated = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      name: "Ada Byron",
      username: "ada_codes",
      displayName: "Ada",
      bio: "",
      preferredLanguage: "java",
      learningLevel: "advanced",
      editorFontSize: 18,
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(profile.requestedUserId, authenticatedUserId);
  assert.equal(profile.name, "Ada Byron");
});

test("duplicate usernames return a conflict without leaking a database error", async (context) => {
  const profile = createProfileDocument({
    save: async () => {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    },
  });
  const { url, headers } = await createProfileServer(context, profile);
  const response = await fetch(url, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      name: "Ada Lovelace",
      username: "ada_codes",
      displayName: "",
      bio: "",
      preferredLanguage: "cpp",
      learningLevel: "beginner",
      editorFontSize: 13,
    }),
  });
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    message: "That username is already taken.",
  });
});

test("account deletion requires confirmation and removes only session-owned learning data", async (context) => {
  const profile = createProfileDocument();
  const session = {
    withTransaction: async (operation) => operation(),
    endSession: async () => {},
  };
  const { url, headers } = await createProfileServer(
    context,
    profile,
    () => ({ session: async () => profile }),
  );
  const operations = [];
  context.mock.method(mongoose, "startSession", async () => session);
  context.mock.method(LearningProgress, "deleteMany", async (filter) => {
    operations.push(["progress", filter]);
    return { deletedCount: 2 };
  });
  context.mock.method(LearningGoal, "deleteOne", async (filter) => {
    operations.push(["goal", filter]);
    return { deletedCount: 1 };
  });
  context.mock.method(User, "deleteOne", async (filter) => {
    operations.push(["user", filter]);
    return { deletedCount: 1 };
  });

  const invalid = await fetch(`${url}/account`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ confirmation: "delete" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(operations.length, 0);

  const response = await fetch(`${url}/account`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ confirmation: "DELETE", userId: otherUserId }),
  });
  assert.equal(response.status, 204);
  assert.equal(operations.length, 3);
  for (const [, filter] of operations) {
    assert.equal(String(filter.userId ?? filter._id), authenticatedUserId);
  }
});
