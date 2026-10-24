import type { SortingEvent, SortingResult } from "./types";

export function mergeSort(values: readonly number[]): SortingResult {
  const items = [...values];
  const events: SortingEvent[] = [];
  let comparisons = 0;
  let movements = 0;

  function sort(start: number, end: number): void {
    if (start >= end) {
      if (start === end) events.push({ type: "sortedRange", start, end });
      return;
    }

    const middle = Math.floor((start + end) / 2);
    events.push({ type: "divide", start, end, middle });
    sort(start, middle);
    sort(middle + 1, end);

    events.push({ type: "mergeStart", start, end });
    const merged: number[] = [];
    let left = start;
    let right = middle + 1;

    while (left <= middle && right <= end) {
      comparisons += 1;
      events.push({ type: "compare", leftIndex: left, rightIndex: right });

      if (items[left] <= items[right]) {
        merged.push(items[left]);
        left += 1;
      } else {
        merged.push(items[right]);
        right += 1;
      }
    }

    while (left <= middle) {
      merged.push(items[left]);
      left += 1;
    }
    while (right <= end) {
      merged.push(items[right]);
      right += 1;
    }

    for (let offset = 0; offset < merged.length; offset += 1) {
      const index = start + offset;
      items[index] = merged[offset];
      movements += 1;
      events.push({ type: "mergeWrite", index, value: merged[offset] });
    }

    events.push({ type: "sortedRange", start, end });
  }

  if (items.length > 0) sort(0, items.length - 1);
  const swaps = 0;
  events.push({ type: "complete", comparisons, swaps, movements });
  return { events, comparisons, swaps, movements };
}
