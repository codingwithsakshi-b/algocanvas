import assert from "node:assert/strict";
import test from "node:test";
import { bubbleSort } from "../src/algorithms/bubbleSort.ts";
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

test("sorts an empty array without comparisons or swaps", () => {
  const result = bubbleSort([]);

  assert.deepEqual(result.events, [
    { type: "complete", comparisons: 0, swaps: 0 },
  ]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.swaps, 0);
});

test("sorts a single-element array without comparisons or swaps", () => {
  const result = bubbleSort([7]);

  assert.deepEqual(replay([7], result.events), [7]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.swaps, 0);
});

test("sorts duplicate values and reports accurate event counts", () => {
  const values = [3, 1, 2, 1];
  const result = bubbleSort(values);
  const completion = result.events.at(-1);

  assert.deepEqual(replay(values, result.events), [1, 1, 2, 3]);
  assert.deepEqual(values, [3, 1, 2, 1]);
  assert.equal(result.comparisons, 6);
  assert.equal(result.swaps, 4);
  assert.deepEqual(completion, {
    type: "complete",
    comparisons: 6,
    swaps: 4,
  });
});

test("stops early for an already-sorted array", () => {
  const result = bubbleSort([1, 2, 3, 4]);

  assert.equal(result.comparisons, 3);
  assert.equal(result.swaps, 0);
});
