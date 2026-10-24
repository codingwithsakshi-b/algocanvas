import type { SortingEvent, SortingResult } from "./types";

export function bubbleSort(values: readonly number[]): SortingResult {
  const items = [...values];
  const events: SortingEvent[] = [];
  let comparisons = 0;
  let swaps = 0;

  for (let end = items.length - 1; end > 0; end -= 1) {
    let swappedInPass = false;

    for (let index = 0; index < end; index += 1) {
      comparisons += 1;
      events.push({
        type: "compare",
        leftIndex: index,
        rightIndex: index + 1,
      });

      if (items[index] > items[index + 1]) {
        [items[index], items[index + 1]] = [items[index + 1], items[index]];
        swaps += 1;
        swappedInPass = true;
        events.push({
          type: "swap",
          leftIndex: index,
          rightIndex: index + 1,
        });
      }
    }

    if (!swappedInPass) break;
  }

  events.push({ type: "complete", comparisons, swaps });
  return { events, comparisons, swaps };
}
