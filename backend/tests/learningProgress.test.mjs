import assert from "node:assert/strict";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import test from "node:test";
import LearningProgress from "../src/models/LearningProgress.ts";
import User from "../src/models/User.ts";
import { createLearningProgressRouter } from "../src/routes/learningProgress.ts";

const sessionSecret = "test-only-learning-progress-secret-32-bytes";
const authenticatedUserId = "507f1f77bcf86cd799439011";
const otherUserId = "507f191e810c19729de860ea";

async function createProgressServer(context) {
  context.mock.method(User, "exists", async () => ({ _id: authenticatedUserId }));

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/learning-progress",
    createLearningProgressRouter({
      allowedOrigins: new Set(["http://localhost:5173"]),
      sessionSecret,
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
    baseUrl: `http://127.0.0.1:${address.port}/api/learning-progress`,
    headers: {
      Cookie: `algocanvas_session=${token}`,
      Origin: "http://localhost:5173",
      "Content-Type": "application/json",
    },
  };
}

test("learning progress requires a session and scopes reads to its user", async (context) => {
  const { baseUrl, headers } = await createProgressServer(context);
  const savedProgress = [
    {
      topicId: "sorting-bubble-sort",
      topicName: "Bubble Sort",
      category: "sorting",
      status: "completed",
    },
  ];
  let readFilter;
  context.mock.method(LearningProgress, "find", (filter) => {
    readFilter = filter;
    return {
      select: () => ({
        sort: () => ({ lean: async () => savedProgress }),
      }),
    };
  });

  assert.equal((await fetch(baseUrl)).status, 401);
  const response = await fetch(baseUrl, { headers });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).progress[0].status, "completed");
  assert.equal(String(readFilter.userId), authenticatedUserId);
  assert.notEqual(String(readFilter.userId), otherUserId);
});

test("progress updates cannot downgrade completed topics and trust only the session user", async (context) => {
  const { baseUrl, headers } = await createProgressServer(context);
  const completed = {
    topicId: "sorting-bubble-sort",
    topicName: "Bubble Sort",
    category: "sorting",
    status: "completed",
  };
  let calls = 0;
  const updateFilters = [];
  let readFilter;
  context.mock.method(
    LearningProgress,
    "findOneAndUpdate",
    (filter) => {
      calls += 1;
      updateFilters.push(filter);
      if (calls === 1) {
        return {
          select: async () => {
            const error = new Error("duplicate key");
            error.code = 11000;
            throw error;
          },
        };
      }
      if (calls === 2) return { select: async () => null };
      return {
        select: async () => ({
          ...completed,
          lastVisitedAt: new Date().toISOString(),
        }),
      };
    },
  );
  context.mock.method(LearningProgress, "findOne", (filter) => {
    readFilter = filter;
    return { select: async () => completed };
  });

  const response = await fetch(`${baseUrl}/sorting-bubble-sort`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      userId: otherUserId,
      topicName: "Bubble Sort",
      category: "sorting",
      status: "in-progress",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).progress.status, "completed");
  assert.equal(calls, 3);
  assert.equal(String(updateFilters[0].userId), authenticatedUserId);
  assert.equal(updateFilters[0].status.$ne, "completed");
  assert.equal(String(updateFilters[2].userId), authenticatedUserId);
  assert.equal(updateFilters[2].status, "completed");
  assert.equal(String(readFilter.userId), authenticatedUserId);
});

test("marking Bubble Sort complete persists completed status under the session user", async (context) => {
  const uniqueTopicIndex = LearningProgress.schema.indexes().find(
    ([fields, options]) =>
      fields.userId === 1 && fields.topicId === 1 && options.unique === true,
  );
  assert.ok(uniqueTopicIndex);

  const { baseUrl, headers } = await createProgressServer(context);
  const savedProgress = {
    topicId: "sorting-bubble-sort",
    topicName: "Bubble Sort",
    category: "sorting",
    status: "completed",
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  let filter;
  let update;
  context.mock.method(LearningProgress, "findOneAndUpdate", (receivedFilter, receivedUpdate) => {
    filter = receivedFilter;
    update = receivedUpdate;
    return { select: async () => savedProgress };
  });

  const response = await fetch(`${baseUrl}/sorting-bubble-sort`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      topicName: "Bubble Sort",
      category: "sorting",
      status: "completed",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).progress.status, "completed");
  assert.equal(String(filter.userId), authenticatedUserId);
  assert.equal(filter.topicId, "sorting-bubble-sort");
  assert.equal(filter.status.$ne, "completed");
  assert.equal(update.$set.status, "completed");
  assert.ok(update.$set.completedAt instanceof Date);
});

test("re-completing a saved topic returns the existing completion without overwriting it", async (context) => {
  const { baseUrl, headers } = await createProgressServer(context);
  const completed = {
    topicId: "sorting-bubble-sort",
    topicName: "Bubble Sort",
    category: "sorting",
    status: "completed",
    completedAt: new Date("2026-10-28T12:00:00.000Z"),
  };
  let updateCalls = 0;
  context.mock.method(LearningProgress, "findOneAndUpdate", () => {
    updateCalls += 1;
    if (updateCalls > 1) return { select: async () => null };
    return {
      select: async () => {
        const error = new Error("duplicate key");
        error.code = 11000;
        throw error;
      },
    };
  });
  context.mock.method(LearningProgress, "findOne", () => ({
    select: async () => completed,
  }));

  const response = await fetch(`${baseUrl}/sorting-bubble-sort`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      topicName: "Bubble Sort",
      category: "sorting",
      status: "completed",
    }),
  });

  assert.equal(response.status, 200);
  const returnedProgress = (await response.json()).progress;
  assert.equal(returnedProgress.status, "completed");
  assert.equal(returnedProgress.completedAt, completed.completedAt.toISOString());
  assert.equal(updateCalls, 2);
});
