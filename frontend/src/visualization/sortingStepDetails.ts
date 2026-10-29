import type {
  SortingAlgorithm,
  SortingEvent,
} from "../algorithms/types";
import type { SortingReplayState } from "./replaySortingEvents";

export interface SortingCodeLine {
  id: string;
  text: string;
}

export interface SortingStepDetails {
  explanation: string;
  code: readonly SortingCodeLine[];
  activeCodeLine: string | null;
}

const sortingCode: Record<SortingAlgorithm, readonly SortingCodeLine[]> = {
  "Bubble Sort": [
    { id: "outer", text: "repeat for each unsorted pass" },
    { id: "compare", text: "compare adjacent values" },
    { id: "swap", text: "swap if left value is greater" },
    { id: "sorted", text: "mark the final value sorted" },
  ],
  "Selection Sort": [
    { id: "minimum", text: "find the smallest remaining value" },
    { id: "compare", text: "compare with the current minimum" },
    { id: "swap", text: "place the minimum at the front" },
    { id: "sorted", text: "mark the next position sorted" },
  ],
  "Insertion Sort": [
    { id: "key", text: "hold the next value as the key" },
    { id: "compare", text: "compare the key with the value before it" },
    { id: "shift", text: "shift a larger value one position right" },
    { id: "insert", text: "insert the key into the open position" },
    { id: "sorted", text: "extend the sorted prefix" },
  ],
  "Merge Sort": [
    { id: "divide", text: "divide the range into smaller halves" },
    { id: "merge", text: "merge two sorted halves" },
    { id: "compare", text: "compare the next values from each half" },
    { id: "write", text: "write the smaller value into the range" },
    { id: "sorted", text: "mark the merged range sorted" },
  ],
  "Quick Sort": [
    { id: "partition", text: "start partitioning this range" },
    { id: "pivot", text: "choose the final value as the pivot" },
    { id: "compare", text: "compare a value with the pivot" },
    { id: "boundary", text: "move the boundary of smaller values" },
    { id: "swap", text: "move a smaller value before the pivot" },
    { id: "place", text: "place the pivot at its final position" },
    { id: "done", text: "finish this partition" },
  ],
};

function activeLineForEvent(
  algorithm: SortingAlgorithm,
  event: SortingEvent,
): string | null {
  switch (event.type) {
    case "compare":
    case "compareKey":
      return "compare";
    case "swap":
      return "swap";
    case "key":
      return "key";
    case "shift":
      return "shift";
    case "write":
      return "insert";
    case "divide":
      return "divide";
    case "mergeStart":
      return "merge";
    case "mergeWrite":
      return "write";
    case "sortedRange":
    case "sorted":
      return "sorted";
    case "partitionStart":
      return "partition";
    case "pivot":
      return "pivot";
    case "partitionBoundary":
      return "boundary";
    case "pivotPlaced":
      return "place";
    case "partitionEnd":
      return "done";
    case "minimum":
      return algorithm === "Selection Sort" ? "minimum" : null;
    case "complete":
      return null;
  }
}

function describeValue(value: number | undefined): string {
  return value === undefined ? "an empty position" : String(value);
}

export function getSortingStepDetails(
  algorithm: SortingAlgorithm,
  event: SortingEvent | undefined,
  snapshot: SortingReplayState,
): SortingStepDetails {
  if (!event) {
    return {
      explanation: "This is the starting array. Play the algorithm or move forward one step.",
      code: sortingCode[algorithm],
      activeCodeLine: null,
    };
  }

  let explanation: string;
  switch (event.type) {
    case "compare":
      explanation = `Compare ${describeValue(snapshot.values[event.leftIndex])} at index ${event.leftIndex} with ${describeValue(snapshot.values[event.rightIndex])} at index ${event.rightIndex}.`;
      break;
    case "compareKey":
      explanation = `Compare key ${snapshot.heldKey ?? describeValue(snapshot.values[event.keyIndex])} with ${describeValue(snapshot.values[event.comparedIndex])} at index ${event.comparedIndex}.`;
      break;
    case "swap":
      explanation = `Exchange the values at indexes ${event.leftIndex} and ${event.rightIndex}.`;
      break;
    case "key":
      explanation = `Hold ${event.value} as the insertion key while larger values move right.`;
      break;
    case "shift":
      explanation = `Move ${event.value} from index ${event.fromIndex} to index ${event.toIndex}.`;
      break;
    case "write":
      explanation = `Insert the held key, ${event.value}, at index ${event.index}.`;
      break;
    case "divide":
      explanation = `Split indexes ${event.start}–${event.end} around the middle at ${event.middle}.`;
      break;
    case "mergeStart":
      explanation = `Combine the sorted values in indexes ${event.start}–${event.end}.`;
      break;
    case "mergeWrite":
      explanation = `Write ${event.value} into index ${event.index} of the merged range.`;
      break;
    case "sortedRange":
      explanation = `The range from index ${event.start} through ${event.end} is now sorted.`;
      break;
    case "partitionStart":
      explanation = `Partition the range from index ${event.start} through ${event.end}.`;
      break;
    case "pivot":
      explanation = `Use ${event.value} at index ${event.index} as the pivot.`;
      break;
    case "partitionBoundary":
      explanation = `The boundary between smaller and larger values is at index ${event.index}.`;
      break;
    case "pivotPlaced":
      explanation = `The pivot is now in its final sorted position at index ${event.index}.`;
      break;
    case "partitionEnd":
      explanation = `Partitioning indexes ${event.start}–${event.end} is complete.`;
      break;
    case "minimum":
      explanation = `The current smallest value is at index ${event.index}.`;
      break;
    case "sorted":
      explanation = `Index ${event.index} is in its sorted position.`;
      break;
    case "complete":
      explanation = `Sorting is complete after ${event.comparisons} comparisons and ${event.swaps} swaps.`;
      break;
  }

  const activeCodeLine = activeLineForEvent(algorithm, event);
  return {
    explanation,
    code: sortingCode[algorithm],
    activeCodeLine:
      activeCodeLine &&
      sortingCode[algorithm].some((line) => line.id === activeCodeLine)
        ? activeCodeLine
        : null,
  };
}
