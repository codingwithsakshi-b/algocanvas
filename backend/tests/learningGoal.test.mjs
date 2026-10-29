import assert from "node:assert/strict";
import cookieParser from "cookie-parser";
import express from "express";
import jwt from "jsonwebtoken";
import { createServer } from "node:http";
import test from "node:test";
import LearningGoal from "../src/models/LearningGoal.ts";
import User from "../src/models/User.ts";
import {
  MAX_LEARNING_GOAL_DURATION_DAYS,
  MAX_LEARNING_GOAL_TOPICS,
  validateLearningGoalInput,
} from "../src/learningGoalValidation.ts";
import { createLearningGoalRouter } from "../src/routes/learningProgress.ts";

const sessionSecret = "test-only-learning-goal-secret-with-32-bytes";
const authenticatedUserId = "507f1f77bcf86cd799439011";

test("learning goal validation accepts valid bounds and rejects invalid values", () => {
  assert.deepEqual(validateLearningGoalInput({ targetTopics: 1, durationDays: 1 }), {
    valid: true,
    value: { targetTopics: 1, durationDays: 1 },
  });
  assert.deepEqual(
    validateLearningGoalInput({
      targetTopics: MAX_LEARNING_GOAL_TOPICS,
      durationDays: MAX_LEARNING_GOAL_DURATION_DAYS,
    }),
    {
      valid: true,
      value: {
        targetTopics: MAX_LEARNING_GOAL_TOPICS,
        durationDays: MAX_LEARNING_GOAL_DURATION_DAYS,
      },
    },
  );
  for (const input of [
    null,
    [],
    {},
    { targetTopics: 0, durationDays: 5 },
    { targetTopics: 1.5, durationDays: 5 },
    { targetTopics: MAX_LEARNING_GOAL_TOPICS + 1, durationDays: 5 },
    { targetTopics: 2, durationDays: 0 },
    { targetTopics: 2, durationDays: 1.5 },
    { targetTopics: 2, durationDays: MAX_LEARNING_GOAL_DURATION_DAYS + 1 },
    { targetTopics: "2", durationDays: 5 },
  ]) {
    assert.equal(validateLearningGoalInput(input).valid, false);
  }
});

test("learning goal schema enforces one goal per user", () => {
  const userIndexes = LearningGoal.schema.indexes().filter(
    ([fields, options]) => fields.userId === 1 && options.unique === true,
  );
  assert.equal(userIndexes.length, 1);
});

test("goal reads, writes, and deletes are scoped to the authenticated session user", async (context) => {
  const filters = {};
  const savedGoal = {
    targetTopics: 3,
    durationDays: 10,
    startedAt: new Date("2026-10-27T12:00:00.000Z"),
    deadlineAt: new Date("2026-11-06T12:00:00.000Z"),
    createdAt: new Date("2026-10-27T12:00:00.000Z"),
    updatedAt: new Date("2026-10-27T12:00:00.000Z"),
  };

  context.mock.method(User, "exists", async () => ({ _id: authenticatedUserId }));
  context.mock.method(LearningGoal, "findOne", (filter) => {
    filters.read = filter;
    return {
      select: () => ({ lean: async () => savedGoal }),
    };
  });
  context.mock.method(LearningGoal, "findOneAndUpdate", (filter, update, options) => {
    filters.write = filter;
    filters.update = update;
    filters.options = options;
    return { select: async () => savedGoal };
  });
  context.mock.method(LearningGoal, "deleteOne", async (filter) => {
    filters.delete = filter;
    return { deletedCount: 1 };
  });

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    "/api/learning-goal",
    createLearningGoalRouter({
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
  const baseUrl = `http://127.0.0.1:${address.port}/api/learning-goal`;
  const token = jwt.sign({}, sessionSecret, {
    algorithm: "HS256",
    subject: authenticatedUserId,
    issuer: "algocanvas",
    audience: "algocanvas-web",
    expiresIn: "1h",
  });
  const headers = {
    Cookie: `algocanvas_session=${token}`,
    Origin: "http://localhost:5173",
  };

  const unauthenticatedResponse = await fetch(baseUrl);
  assert.equal(unauthenticatedResponse.status, 401);

  const readResponse = await fetch(baseUrl, { headers });
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).goal.targetTopics, 3);
  assert.equal(String(filters.read.userId), authenticatedUserId);

  const invalidWriteResponse = await fetch(baseUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ targetTopics: 0, durationDays: 10 }),
  });
  assert.equal(invalidWriteResponse.status, 400);
  assert.equal(filters.write, undefined);

  const writeResponse = await fetch(baseUrl, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "507f191e810c19729de860ea",
      targetTopics: 3,
      durationDays: 10,
    }),
  });
  assert.equal(writeResponse.status, 200);
  assert.equal(String(filters.write.userId), authenticatedUserId);
  assert.equal(filters.update.$set.targetTopics, 3);
  assert.equal(filters.options.upsert, true);
  assert.equal(filters.options.runValidators, true);

  const deleteResponse = await fetch(baseUrl, { method: "DELETE", headers });
  assert.equal(deleteResponse.status, 204);
  assert.equal(String(filters.delete.userId), authenticatedUserId);
});
