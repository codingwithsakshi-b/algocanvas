import type { SortingEvent, SortingResult } from "./types";

export function selectionSort(values: readonly number[]): SortingResult {
  const items = [...values];
  const events: SortingEvent[] = [];
  let comparisons = 0;
  let swaps = 0;

  for (let start = 0; start < items.length; start += 1) {
    let minimumIndex = start;
    events.push({ type: "minimum", index: minimumIndex });

    for (let index = start + 1; index < items.length; index += 1) {
      comparisons += 1;
      events.push({
        type: "compare",
        leftIndex: minimumIndex,
        rightIndex: index,
      });

      if (items[index] < items[minimumIndex]) {
        minimumIndex = index;
        events.push({ type: "minimum", index: minimumIndex });
      }
    }

    if (minimumIndex !== start) {
      [items[start], items[minimumIndex]] = [items[minimumIndex], items[start]];
      swaps += 1;
      events.push({
        type: "swap",
        leftIndex: start,
        rightIndex: minimumIndex,
      });
    }

    events.push({ type: "sorted", index: start });
  }

  events.push({ type: "complete", comparisons, swaps });
  return { events, comparisons, swaps };
}
