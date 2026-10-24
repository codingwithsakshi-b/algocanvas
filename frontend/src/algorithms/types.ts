export type SortingEvent =
  | { type: "compare"; leftIndex: number; rightIndex: number }
  | { type: "compareKey"; comparedIndex: number; keyIndex: number }
  | { type: "swap"; leftIndex: number; rightIndex: number }
  | { type: "key"; index: number; value: number }
  | { type: "shift"; fromIndex: number; toIndex: number; value: number }
  | { type: "write"; index: number; value: number }
  | { type: "divide"; start: number; end: number; middle: number }
  | { type: "mergeStart"; start: number; end: number }
  | { type: "mergeWrite"; index: number; value: number }
  | { type: "sortedRange"; start: number; end: number }
  | { type: "partitionStart"; start: number; end: number }
  | { type: "pivot"; index: number; value: number }
  | { type: "partitionBoundary"; index: number }
  | { type: "pivotPlaced"; index: number }
  | { type: "partitionEnd"; start: number; end: number }
  | { type: "minimum"; index: number }
  | { type: "sorted"; index: number }
  | {
      type: "complete";
      comparisons: number;
      swaps: number;
      movements?: number;
    };

export interface SortingResult {
  events: SortingEvent[];
  comparisons: number;
  swaps: number;
  movements?: number;
}

export type SortingAlgorithm =
  | "Bubble Sort"
  | "Selection Sort"
  | "Insertion Sort"
  | "Merge Sort"
  | "Quick Sort";
