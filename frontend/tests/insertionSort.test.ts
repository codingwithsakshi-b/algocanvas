import assert from "node:assert/strict";
import test from "node:test";
import { insertionSort } from "../src/algorithms/insertionSort.ts";
import type { SortingEvent } from "../src/algorithms/types.ts";

function replay(values: number[], events: SortingEvent[]): number[] {
  const result: Array<number | undefined> = [...values];

  for (const event of events) {
    if (event.type === "key") {
      result[event.index] = undefined;
    } else if (event.type === "shift") {
      result[event.toIndex] = event.value;
      result[event.fromIndex] = undefined;
    } else if (event.type === "write") {
      result[event.index] = event.value;
    } else if (event.type === "swap") {
      [result[event.leftIndex], result[event.rightIndex]] = [
        result[event.rightIndex],
        result[event.leftIndex],
      ];
    }
  }

  return result.map((value) => {
    if (value === undefined) throw new Error("Insertion left an empty slot");
    return value;
  });
}

test("handles an empty array without comparisons or movements", () => {
  const result = insertionSort([]);

  assert.deepEqual(result.events, [
    { type: "complete", comparisons: 0, swaps: 0, movements: 0 },
  ]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.swaps, 0);
  assert.equal(result.movements, 0);
});

test("handles a single value without comparisons or movements", () => {
  const result = insertionSort([7]);

  assert.deepEqual(replay([7], result.events), [7]);
  assert.equal(result.comparisons, 0);
  assert.equal(result.movements, 0);
});

test("sorts duplicates using shifts and key writes, not swaps", () => {
  const values = [3, 1, 2, 1];
  const result = insertionSort(values);

  assert.deepEqual(replay(values, result.events), [1, 1, 2, 3]);
  assert.deepEqual(values, [3, 1, 2, 1]);
  assert.equal(result.comparisons, 6);
  assert.equal(result.swaps, 0);
  assert.equal(result.movements, 7);
  assert.equal(result.events.filter((event) => event.type === "shift").length, 4);
  assert.equal(result.events.filter((event) => event.type === "write").length, 3);
});

test("uses linear comparisons and one key write per item when sorted", () => {
  const values = [1, 2, 3, 4];
  const result = insertionSort(values);

  assert.deepEqual(replay(values, result.events), values);
  assert.equal(result.comparisons, 3);
  assert.equal(result.swaps, 0);
  assert.equal(result.movements, 3);
  assert.equal(result.events.filter((event) => event.type === "shift").length, 0);
});

test("sorts reverse-ordered values and records each shift", () => {
  const values = [4, 3, 2, 1];
  const result = insertionSort(values);

  assert.deepEqual(replay(values, result.events), [1, 2, 3, 4]);
  assert.equal(result.comparisons, 6);
  assert.equal(result.swaps, 0);
  assert.equal(result.movements, 9);
  assert.equal(result.events.filter((event) => event.type === "shift").length, 6);
  assert.equal(result.events.filter((event) => event.type === "write").length, 3);
});

test("sorts values below zero", () => {
  const values = [0, -4, 3, -2];
  const result = insertionSort(values);

  assert.deepEqual(replay(values, result.events), [-4, -2, 0, 3]);
  assert.deepEqual(values, [0, -4, 3, -2]);
});
