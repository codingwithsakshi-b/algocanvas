# AlgoCanvas

AlgoCanvas is an interactive data structures and algorithms visualizer built
with React, TypeScript, and Vite. Bubble Sort, Selection Sort, Insertion Sort,
Merge Sort, and Quick Sort are available sorting visualizations; other sorting
algorithms remain disabled until they have event generators.

Quick Sort uses iterative Lomuto partitioning with the last element as pivot.
It defers the larger partition while processing the smaller one first to keep
its pending-range stack bounded.

## Development

Install dependencies, then start the local development server:

```sh
npm install
npm run dev
```

## Validation

```sh
npm test
npm run build
npm run lint
```

The sorting tests use Node's built-in test runner and TypeScript type
stripping, so use Node.js 24 or newer.

## Event and statistics conventions

Each algorithm is a pure function from a readonly number array to a
`SortingResult` containing typed events and final counters. The visualization
reconstructs any playback step by replaying the event prefix; this keeps
backward stepping deterministic and isolates the algorithms from React. A
future native or WebAssembly engine can implement the same `SortingResult`
contract and event union without changing the visualization controller.

Comparisons count value-to-value comparisons. Swap counts include only actual
exchanges. Insertion Sort movements count shifts plus insertion writes; Merge
Sort movements count writes back into the array. Quick Sort reports swaps, not
an additional movement count.
