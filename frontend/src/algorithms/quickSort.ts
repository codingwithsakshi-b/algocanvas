import type { SortingEvent, SortingResult } from "./types";

export function quickSort(values: readonly number[]): SortingResult {
  const items = [...values];
  const events: SortingEvent[] = [];
  const pendingRanges: Array<{ start: number; end: number }> = [];
  let comparisons = 0;
  let swaps = 0;

  if (items.length > 1) {
    pendingRanges.push({ start: 0, end: items.length - 1 });
  }

  // Lomuto partitioning uses the last element as pivot. Process the smaller
  // partition next and defer the larger one to keep the work stack bounded.
  while (pendingRanges.length > 0) {
    const range = pendingRanges.pop();
    if (!range) break;
    const { start, end } = range;
    events.push({ type: "partitionStart", start, end });

    const pivotValue = items[end];
    events.push({ type: "pivot", index: end, value: pivotValue });
    let boundary = start;
    events.push({ type: "partitionBoundary", index: boundary });

    for (let scan = start; scan < end; scan += 1) {
      comparisons += 1;
      events.push({
        type: "compare",
        leftIndex: scan,
        rightIndex: end,
      });

      if (items[scan] <= pivotValue) {
        if (scan !== boundary) {
          [items[scan], items[boundary]] = [items[boundary], items[scan]];
          swaps += 1;
          events.push({
            type: "swap",
            leftIndex: scan,
            rightIndex: boundary,
          });
        }
        boundary += 1;
        events.push({ type: "partitionBoundary", index: boundary });
      }
    }

    if (boundary !== end) {
      [items[boundary], items[end]] = [items[end], items[boundary]];
      swaps += 1;
      events.push({
        type: "swap",
        leftIndex: boundary,
        rightIndex: end,
      });
    }

    events.push({ type: "pivotPlaced", index: boundary });
    events.push({ type: "partitionEnd", start, end });

    const left = { start, end: boundary - 1 };
    const right = { start: boundary + 1, end };
    const leftSize = left.end - left.start + 1;
    const rightSize = right.end - right.start + 1;
    const smaller = leftSize <= rightSize ? left : right;
    const larger = leftSize <= rightSize ? right : left;

    if (larger.start < larger.end) pendingRanges.push(larger);
    if (smaller.start < smaller.end) pendingRanges.push(smaller);
  }

  events.push({ type: "complete", comparisons, swaps });
  return { events, comparisons, swaps };
}
