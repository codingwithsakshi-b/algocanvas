import assert from "node:assert/strict";
import test from "node:test";
import { selectionSort } from "../src/algorithms/selectionSort.ts";
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

test("handles empty input without comparisons or swaps", () => {
  const result = selectionSort([]);

  assert.deepEqual(result.events, [
    { type: "complete", comparisons: 0, swaps: 0 },
  ]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.swaps, 0);
});

test("handles one element without comparisons or swaps", () => {
  const result = selectionSort([7]);

  assert.deepEqual(replay([7], result.events), [7]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.swaps, 0);
});

test("sorts duplicates, tracks minima, and reports actual operations", () => {
  const values = [3, 1, 2, 1];
  const result = selectionSort(values);

  assert.deepEqual(replay(values, result.events), [1, 1, 2, 3]);
  assert.deepEqual(values, [3, 1, 2, 1]);
  assert.equal(result.comparisons, 6);
  assert.equal(result.swaps, 2);
  assert.deepEqual(
    result.events.filter((event) => event.type === "minimum"),
    [
      { type: "minimum", index: 0 },
      { type: "minimum", index: 1 },
      { type: "minimum", index: 1 },
      { type: "minimum", index: 2 },
      { type: "minimum", index: 3 },
      { type: "minimum", index: 2 },
      { type: "minimum", index: 3 },
    ],
  );
  assert.deepEqual(
    result.events.filter((event) => event.type === "sorted"),
    [0, 1, 2, 3].map((index) => ({ type: "sorted", index })),
  );
});

test("performs every comparison and no swaps for sorted input", () => {
  const result = selectionSort([1, 2, 3, 4]);

  assert.deepEqual(replay([1, 2, 3, 4], result.events), [1, 2, 3, 4]);
  assert.equal(result.comparisons, 6);
  assert.equal(result.swaps, 0);
});

test("sorts reverse-sorted input and counts selection swaps", () => {
  const values = [4, 3, 2, 1];
  const result = selectionSort(values);

  assert.deepEqual(replay(values, result.events), [1, 2, 3, 4]);
  assert.equal(result.comparisons, 6);
  assert.equal(result.swaps, 2);
});
