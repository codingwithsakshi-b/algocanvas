import { bubbleSort } from "./bubbleSort.ts";
import { insertionSort } from "./insertionSort.ts";
import { mergeSort } from "./mergeSort.ts";
import { quickSort } from "./quickSort.ts";
import { selectionSort } from "./selectionSort.ts";
import type { SortingAlgorithm, SortingEngine } from "./types";

export const typeScriptSortingEngine: SortingEngine = {
  sort(algorithm: SortingAlgorithm, values: readonly number[]) {
    switch (algorithm) {
      case "Bubble Sort":
        return bubbleSort(values);
      case "Selection Sort":
        return selectionSort(values);
      case "Insertion Sort":
        return insertionSort(values);
      case "Merge Sort":
        return mergeSort(values);
      case "Quick Sort":
        return quickSort(values);
    }
  },
};
