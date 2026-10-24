import assert from "node:assert/strict";
import test from "node:test";
import { bubbleSort } from "../src/algorithms/bubbleSort.ts";
import { insertionSort } from "../src/algorithms/insertionSort.ts";
import { mergeSort } from "../src/algorithms/mergeSort.ts";
import { quickSort } from "../src/algorithms/quickSort.ts";
import { selectionSort } from "../src/algorithms/selectionSort.ts";
import type { SortingAlgorithm, SortingResult } from "../src/algorithms/types.ts";
import { replaySortingEvents } from "../src/visualization/replaySortingEvents.ts";

const algorithms: Array<{
  name: SortingAlgorithm;
  sort: (values: readonly number[]) => SortingResult;
}> = [
  { name: "Bubble Sort", sort: bubbleSort },
  { name: "Selection Sort", sort: selectionSort },
  { name: "Insertion Sort", sort: insertionSort },
  { name: "Merge Sort", sort: mergeSort },
  { name: "Quick Sort", sort: quickSort },
];

for (const { name, sort } of algorithms) {
  test(`${name} replay restores exact state for every event prefix`, () => {
    const initial = [5, 2, 4, 1, 3];
    const result = sort(initial);
    const snapshots = result.events.map((_, index) =>
      replaySortingEvents(initial, result.events, index + 1, name),
    );

    snapshots.forEach((snapshot, index) => {
      assert.deepEqual(
        replaySortingEvents(initial, result.events, index + 1, name),
        snapshot,
      );
      assert.deepEqual(
        replaySortingEvents(initial, result.events, index, name),
        index === 0
          ? replaySortingEvents(initial, result.events, 0, name)
          : snapshots[index - 1],
      );
    });

    const final = snapshots.at(-1);
    assert.deepEqual(final?.values, [1, 2, 3, 4, 5]);
    assert.equal(final?.comparisons, result.comparisons);
    assert.equal(final?.swaps, result.swaps);
    assert.equal(final?.movements, result.movements ?? 0);
    assert.deepEqual(
      [...(final?.sortedIndices ?? [])].sort((left, right) => left - right),
      [0, 1, 2, 3, 4],
    );
  });
}

test("Quick Sort back-step restores the active pivot and partition range", () => {
  const values = [3, 1, 2];
  const { events } = quickSort(values);
  const pivotStep = events.findIndex((event) => event.type === "pivot") + 1;
  const swapStep = events.findIndex((event) => event.type === "swap") + 1;
  const beforeSwap = replaySortingEvents(
    values,
    events,
    swapStep - 1,
    "Quick Sort",
  );
  const afterSwap = replaySortingEvents(values, events, swapStep, "Quick Sort");
  const pivotState = replaySortingEvents(values, events, pivotStep, "Quick Sort");

  assert.deepEqual(beforeSwap.values, values);
  assert.equal(pivotState.pivotIndex, 2);
  assert.deepEqual(pivotState.partitionRange, { start: 0, end: 2 });
  assert.deepEqual(afterSwap.values, [1, 3, 2]);
  assert.deepEqual(beforeSwap.partitionRange, afterSwap.partitionRange);
  assert.equal(beforeSwap.pivotIndex, afterSwap.pivotIndex);
});

test("clamps replay step boundaries", () => {
  const values = [2, 1];
  const { events } = quickSort(values);

  assert.deepEqual(
    replaySortingEvents(values, events, -1, "Quick Sort"),
    replaySortingEvents(values, events, 0, "Quick Sort"),
  );
  assert.deepEqual(
    replaySortingEvents(values, events, events.length + 1, "Quick Sort"),
    replaySortingEvents(values, events, events.length, "Quick Sort"),
  );
});
