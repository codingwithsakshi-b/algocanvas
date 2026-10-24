import type { SortingEvent, SortingResult } from "./types";

export function insertionSort(values: readonly number[]): SortingResult {
  const items = [...values];
  const events: SortingEvent[] = [];
  let comparisons = 0;
  let movements = 0;

  if (items.length > 0) events.push({ type: "sorted", index: 0 });

  for (let index = 1; index < items.length; index += 1) {
    const key = items[index];
    let position = index - 1;
    events.push({ type: "key", index, value: key });

    while (position >= 0) {
      comparisons += 1;
      events.push({
        type: "compareKey",
        comparedIndex: position,
        keyIndex: index,
      });

      if (items[position] <= key) break;

      items[position + 1] = items[position];
      movements += 1;
      events.push({
        type: "shift",
        fromIndex: position,
        toIndex: position + 1,
        value: items[position],
      });
      position -= 1;
    }

    items[position + 1] = key;
    movements += 1;
    events.push({ type: "write", index: position + 1, value: key });
    events.push({ type: "sorted", index });
  }

  const swaps = 0;
  events.push({ type: "complete", comparisons, swaps, movements });
  return { events, comparisons, swaps, movements };
}
