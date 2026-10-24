import type {
  SortingAlgorithm,
  SortingEvent,
} from "../algorithms/types";

export interface SortingReplayState {
  values: Array<number | undefined>;
  comparisons: number;
  swaps: number;
  movements: number;
  minimumIndex?: number;
  keyIndex?: number;
  heldKey?: number;
  mergeRange?: { start: number; end: number };
  partitionRange?: { start: number; end: number };
  pivotIndex?: number;
  pivotValue?: number;
  partitionBoundary?: number;
  sortedIndices: Set<number>;
  activeEvent?: SortingEvent;
  activeIndices: number[];
}

export function replaySortingEvents(
  initialValues: readonly number[],
  events: readonly SortingEvent[],
  step: number,
  algorithm: SortingAlgorithm,
): SortingReplayState {
  const boundedStep = Math.max(0, Math.min(step, events.length));
  const state: SortingReplayState = {
    values: [...initialValues],
    comparisons: 0,
    swaps: 0,
    movements: 0,
    sortedIndices: new Set<number>(),
    activeIndices: [],
  };

  for (const event of events.slice(0, boundedStep)) {
    if (event.type === "compare" || event.type === "compareKey") {
      state.comparisons += 1;
    }

    if (event.type === "swap") {
      state.swaps += 1;
      [state.values[event.leftIndex], state.values[event.rightIndex]] = [
        state.values[event.rightIndex],
        state.values[event.leftIndex],
      ];
    } else if (event.type === "key") {
      state.keyIndex = event.index;
      state.heldKey = event.value;
      state.values[event.index] = undefined;
    } else if (event.type === "shift") {
      state.values[event.toIndex] = event.value;
      state.values[event.fromIndex] = undefined;
      state.keyIndex = event.fromIndex;
      state.movements += 1;

      for (const index of state.sortedIndices) {
        if (index >= event.fromIndex) state.sortedIndices.delete(index);
      }
    } else if (event.type === "write") {
      state.values[event.index] = event.value;
      state.keyIndex = undefined;
      state.heldKey = undefined;
      state.movements += 1;
    } else if (event.type === "mergeStart") {
      state.mergeRange = { start: event.start, end: event.end };
    } else if (event.type === "mergeWrite") {
      state.values[event.index] = event.value;
      state.movements += 1;
    } else if (event.type === "partitionStart") {
      state.partitionRange = { start: event.start, end: event.end };
      state.pivotIndex = undefined;
      state.pivotValue = undefined;
      state.partitionBoundary = undefined;
    } else if (event.type === "pivot") {
      state.pivotIndex = event.index;
      state.pivotValue = event.value;
    } else if (event.type === "partitionBoundary") {
      state.partitionBoundary = event.index;
    } else if (event.type === "pivotPlaced") {
      state.sortedIndices.add(event.index);
      state.pivotIndex = undefined;
    } else if (event.type === "partitionEnd") {
      state.partitionRange = undefined;
      state.partitionBoundary = undefined;
    } else if (event.type === "sortedRange") {
      for (let index = event.start; index <= event.end; index += 1) {
        state.sortedIndices.add(index);
      }
      if (
        state.mergeRange?.start === event.start &&
        state.mergeRange.end === event.end
      ) {
        state.mergeRange = undefined;
      }
    } else if (event.type === "minimum") {
      state.minimumIndex = event.index;
    } else if (event.type === "sorted") {
      if (algorithm === "Insertion Sort") {
        for (let index = 0; index <= event.index; index += 1) {
          state.sortedIndices.add(index);
        }
      } else {
        state.sortedIndices.add(event.index);
      }
      state.minimumIndex = undefined;
    }
  }

  if (
    (algorithm === "Bubble Sort" || algorithm === "Quick Sort") &&
    boundedStep === events.length
  ) {
    state.values.forEach((_, index) => state.sortedIndices.add(index));
  }

  state.activeEvent =
    boundedStep > 0 ? events[boundedStep - 1] : undefined;
  const event = state.activeEvent;
  if (event?.type === "compare" || event?.type === "swap") {
    state.activeIndices = [event.leftIndex, event.rightIndex];
  } else if (event?.type === "compareKey") {
    state.activeIndices = [event.comparedIndex];
  } else if (event?.type === "shift") {
    state.activeIndices = [event.fromIndex, event.toIndex];
  } else if (event?.type === "mergeWrite") {
    state.activeIndices = [event.index];
  } else if (
    event?.type === "pivot" ||
    event?.type === "pivotPlaced" ||
    event?.type === "key" ||
    event?.type === "write"
  ) {
    state.activeIndices = [event.index];
  }

  return state;
}
