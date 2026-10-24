import assert from "node:assert/strict";
import test from "node:test";
import { bubbleSort } from "../src/algorithms/bubbleSort.ts";
import { insertionSort } from "../src/algorithms/insertionSort.ts";
import { mergeSort } from "../src/algorithms/mergeSort.ts";
import { quickSort } from "../src/algorithms/quickSort.ts";
import { selectionSort } from "../src/algorithms/selectionSort.ts";
import { typeScriptSortingEngine } from "../src/algorithms/typescriptSortingEngine.ts";
import type { SortingAlgorithm } from "../src/algorithms/types.ts";

const algorithms: Array<{
  name: SortingAlgorithm;
  implementation: (values: readonly number[]) => ReturnType<typeof bubbleSort>;
}> = [
  { name: "Bubble Sort", implementation: bubbleSort },
  { name: "Selection Sort", implementation: selectionSort },
  { name: "Insertion Sort", implementation: insertionSort },
  { name: "Merge Sort", implementation: mergeSort },
  { name: "Quick Sort", implementation: quickSort },
];

test("TypeScript sorting engine delegates without changing algorithm results", () => {
  for (const { name, implementation } of algorithms) {
    const input = [5, -1, 3, 3, 0];
    const originalInput = [...input];
    const expected = implementation(input);
    const actual = typeScriptSortingEngine.sort(name, input);

    assert.deepEqual(actual, expected, `${name} result should remain unchanged`);
    assert.deepEqual(input, originalInput, `${name} should not mutate its input`);
  }
});
