import assert from "node:assert/strict";
import test from "node:test";
import { calculateGoalProgress } from "../src/learning/goalProgress.ts";

test("learning goal progress uses completed saved topics", () => {
  const now = new Date("2026-10-27T12:00:00.000Z");
  const progress = calculateGoalProgress(
    3,
    5,
    "2026-10-30T12:00:00.000Z",
    now,
  );

  assert.deepEqual(progress, {
    completedTopics: 3,
    remainingTopics: 2,
    percentage: 60,
    remainingDays: 3,
    isComplete: false,
  });
});

test("learning goal progress caps the bar and reports achieved goals", () => {
  const progress = calculateGoalProgress(
    7,
    5,
    "2026-10-30T12:00:00.000Z",
    new Date("2026-10-31T12:00:00.000Z"),
  );

  assert.equal(progress.completedTopics, 7);
  assert.equal(progress.remainingTopics, 0);
  assert.equal(progress.percentage, 100);
  assert.equal(progress.remainingDays, 0);
  assert.equal(progress.isComplete, true);
});
