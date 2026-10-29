import assert from "node:assert/strict";
import test from "node:test";
import { typeScriptSortingEngine } from "../src/algorithms/typescriptSortingEngine.ts";
import type { SortingAlgorithm } from "../src/algorithms/types.ts";
import { replaySortingEvents } from "../src/visualization/replaySortingEvents.ts";
import { getSortingStepDetails } from "../src/visualization/sortingStepDetails.ts";

const algorithms: SortingAlgorithm[] = [
  "Bubble Sort",
  "Selection Sort",
  "Insertion Sort",
  "Merge Sort",
  "Quick Sort",
];

for (const algorithm of algorithms) {
  test(`${algorithm} exposes explanations and matching pseudocode for actual steps`, () => {
    const initialValues = [4, 1, 3, 2];
    const result = typeScriptSortingEngine.sort(algorithm, initialValues);
    const startingState = replaySortingEvents(
      initialValues,
      result.events,
      0,
      algorithm,
    );
    const initialDetails = getSortingStepDetails(
      algorithm,
      undefined,
      startingState,
    );

    assert.match(initialDetails.explanation, /starting array/i);
    assert.equal(initialDetails.activeCodeLine, null);
    assert.ok(initialDetails.code.length > 0);

    result.events.forEach((event, index) => {
      const snapshot = replaySortingEvents(
        initialValues,
        result.events,
        index + 1,
        algorithm,
      );
      const details = getSortingStepDetails(algorithm, event, snapshot);

      assert.ok(details.explanation.length > 0);
      assert.ok(
        details.activeCodeLine === null ||
          details.code.some((line) => line.id === details.activeCodeLine),
      );
    });

    const finalSnapshot = replaySortingEvents(
      initialValues,
      result.events,
      result.events.length,
      algorithm,
    );
    const resetSnapshot = replaySortingEvents(
      initialValues,
      result.events,
      0,
      algorithm,
    );
    assert.deepEqual(resetSnapshot.values, initialValues);
    assert.deepEqual(finalSnapshot.values, [1, 2, 3, 4]);
  });
}
