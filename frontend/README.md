# AlgoCanvas

AlgoCanvas is an interactive data structures and algorithms visualizer built
with React, TypeScript, and Vite. Its Data Structures workspace includes Arrays,
Singly Linked Lists, Stacks & Queues, and an interactive Trees visualizer. The
queue uses a bounded circular buffer and shows its physical slots and wraparound.
The Trees module includes a duplicate-rejecting binary search tree, node
properties, and preorder, inorder, postorder, and level-order traversal playback.
Graph Explorer provides an interactive graph editor with BFS, DFS, and Dijkstra
algorithm playback.
The Code Playground provides an editor and sandboxed execution for C++, C,
Python, and Java source files.
Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, and Quick Sort are
available sorting visualizations; other sorting algorithms remain disabled until
they have event generators.

Quick Sort uses iterative Lomuto partitioning with the last element as pivot.
It defers the larger partition while processing the smaller one first to keep
its pending-range stack bounded.

## Code Playground

Open **Code Playground** from the workspace sidebar (or go to `#playground`).
The editor uses CodeMirror and supports C++, C, Python, and Java highlighting,
blank files, optional Hello World templates, local uploads, and browser
downloads. Uploaded files are never executed automatically. Source files are
not stored by AlgoCanvas.

### Enable code execution

Execution uses the free, keyless [Wandbox API](https://wandbox.org/). The
frontend calls only the AlgoCanvas backend. For each run, the backend fetches
Wandbox's current compiler list, selects a matching compiler, and submits
source plus stdin to `/api/compile.json` with `save: false`. AlgoCanvas does not
save submissions, but Wandbox receives the source code and input as a shared
third-party service. Review the [official Wandbox API specification](https://github.com/melpon/wandbox/blob/8ddc61c3fdec16b1647c7f4f3060d2cd66de5e6f/kennel2/API.rst)
and service privacy terms before running private code.

No API key or provider environment variables are required. The service is
shared, can impose its own execution and request limits, and may experience
downtime; no service-level guarantee is implied. The backend applies a 32 KB
source limit, an 8 KB stdin limit, a 15-second timeout per Wandbox request, a
256 KB response limit, and a small in-memory request rate limit. Output fields
are shortened to 16 KB each. A service timeout, unsupported compiler, or
provider failure is reported as an error rather than replaced with sample
output. Wandbox does not provide cancellation through this integration, so
Stop is disabled.

Wandbox compiler IDs are discovered from `GET https://wandbox.org/api/list.json`
at execution time, not hardcoded. To manually verify:

1. Select the **C++** language, choose the **Hello world** template, and click
   **Run**; expect `Hello, world!` in stdout.
2. Select **C**, choose its **Hello world** template, and run it; expect
   `Hello, world!` in stdout.
3. Select **Python**, choose its template, replace its source with
   `print(input())`, enter `hello` in **Standard input**, and run it; expect
   `hello` in stdout.
4. Select **Java**, choose its **Hello world** template, and run it; expect
   `Hello, world!` in stdout.

For error handling, introduce a syntax error in a C/C++/Java program and check
the compiler diagnostics; for a runtime error, use Python `raise
RuntimeError("test")` and check stderr and the non-zero exit status.

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
