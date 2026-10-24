import assert from "node:assert/strict";
import test from "node:test";
import { quickSort } from "../src/algorithms/quickSort.ts";
import type { SortingEvent } from "../src/algorithms/types.ts";

function replay(values: number[], events: SortingEvent[]): number[] {
  const result = [...values];

  for (const event of events) {
    if (event.type === "swap") {
      [result[event.leftIndex], result[event.rightIndex]] = [
        result[event.rightIndex],
        result[event.leftIndex],
      ];
    }
  }

  return result;
}

function expectSorted(values: number[]): void {
  const original = [...values];
  const result = quickSort(values);
  const expected = [...values].sort((left, right) => left - right);
  const complete = result.events.at(-1);

  assert.deepEqual(replay(values, result.events), expected);
  assert.deepEqual(values, original);
  assert.equal(result.swaps, result.events.filter((event) => event.type === "swap").length);
  assert.equal(
    result.comparisons,
    result.events.filter((event) => event.type === "compare").length,
  );
  assert.deepEqual(complete, {
    type: "complete",
    comparisons: result.comparisons,
    swaps: result.swaps,
  });
}

test("handles empty input", () => {
  const result = quickSort([]);

  assert.deepEqual(result.events, [
    { type: "complete", comparisons: 0, swaps: 0 },
  ]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.swaps, 0);
});

test("handles a single element without partitioning", () => {
  const result = quickSort([9]);

  assert.deepEqual(result.events, [
    { type: "complete", comparisons: 0, swaps: 0 },
  ]);
});

test("sorts duplicates and emits Lomuto partition state", () => {
  const values = [3, 1, 2, 1];
  const result = quickSort(values);

  assert.deepEqual(replay(values, result.events), [1, 1, 2, 3]);
  assert.ok(result.events.some((event) => event.type === "pivot"));
  assert.ok(result.events.some((event) => event.type === "partitionBoundary"));
  assert.ok(result.events.some((event) => event.type === "partitionStart"));
  assert.ok(result.events.some((event) => event.type === "partitionEnd"));
  assert.deepEqual(values, [3, 1, 2, 1]);
});

test("sorts an already-sorted array", () => {
  expectSorted([1, 2, 3, 4, 5]);
});

test("sorts a reverse-sorted array", () => {
  expectSorted([5, 4, 3, 2, 1]);
});

test("supports negative values", () => {
  expectSorted([0, -4, 3, -2, -4]);
});

test("sorts many repeated values", () => {
  expectSorted(Array.from({ length: 40 }, (_, index) => index % 4 - 2));
});

test("handles sorted worst-case input iteratively without recursive stack growth", () => {
  const values = Array.from({ length: 250 }, (_, index) => index);
  expectSorted(values);
});
