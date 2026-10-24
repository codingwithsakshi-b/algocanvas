import assert from "node:assert/strict";
import test from "node:test";
import { mergeSort } from "../src/algorithms/mergeSort.ts";
import type { SortingEvent } from "../src/algorithms/types.ts";

function replay(values: number[], events: SortingEvent[]): number[] {
  const result = [...values];

  for (const event of events) {
    if (event.type === "mergeWrite") result[event.index] = event.value;
    if (event.type === "swap") {
      [result[event.leftIndex], result[event.rightIndex]] = [
        result[event.rightIndex],
        result[event.leftIndex],
      ];
    }
  }

  return result;
}

test("handles empty input without comparisons or movements", () => {
  const result = mergeSort([]);

  assert.deepEqual(result.events, [
    { type: "complete", comparisons: 0, swaps: 0, movements: 0 },
  ]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.movements, 0);
});

test("handles a single element without comparisons or movements", () => {
  const result = mergeSort([7]);

  assert.deepEqual(replay([7], result.events), [7]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.movements, 0);
});

test("sorts duplicates and records merge writes instead of swaps", () => {
  const values = [3, 1, 2, 1];
  const result = mergeSort(values);

  assert.deepEqual(replay(values, result.events), [1, 1, 2, 3]);
  assert.deepEqual(values, [3, 1, 2, 1]);
  assert.equal(result.comparisons, 5);
  assert.equal(result.movements, 8);
  assert.equal(result.swaps, 0);
  assert.equal(result.events.filter((event) => event.type === "mergeWrite").length, 8);
});

test("sorts already-sorted values", () => {
  const values = [1, 2, 3, 4];
  const result = mergeSort(values);

  assert.deepEqual(replay(values, result.events), values);
  assert.equal(result.comparisons, 4);
  assert.equal(result.movements, 8);
});

test("sorts reverse-ordered values", () => {
  const values = [4, 3, 2, 1];
  const result = mergeSort(values);

  assert.deepEqual(replay(values, result.events), [1, 2, 3, 4]);
  assert.equal(result.comparisons, 4);
  assert.equal(result.movements, 8);
});

test("sorts negative values and preserves stable merge comparisons", () => {
  const values = [0, -4, 3, -2];
  const result = mergeSort(values);

  assert.deepEqual(replay(values, result.events), [-4, -2, 0, 3]);
  assert.deepEqual(values, [0, -4, 3, -2]);
});

test("sorts a non-power-of-two array and emits divide and merge ranges", () => {
  const values = [8, 3, 7, 4, 9, 2, 6];
  const result = mergeSort(values);

  assert.deepEqual(replay(values, result.events), [2, 3, 4, 6, 7, 8, 9]);
  assert.equal(result.movements, 20);
  assert.ok(result.events.some((event) => event.type === "divide"));
  assert.ok(result.events.some((event) => event.type === "mergeStart"));
  assert.ok(result.events.some((event) => event.type === "sortedRange"));
});
