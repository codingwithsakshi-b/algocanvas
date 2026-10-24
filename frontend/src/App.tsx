
import { useEffect, useMemo, useState } from "react";
import { bubbleSort } from "./algorithms/bubbleSort";
import { insertionSort } from "./algorithms/insertionSort";
import { mergeSort } from "./algorithms/mergeSort";
import { quickSort } from "./algorithms/quickSort";
import { selectionSort } from "./algorithms/selectionSort";
import type { SortingAlgorithm } from "./algorithms/types";
import { replaySortingEvents } from "./visualization/replaySortingEvents";
import ArraysVisualizer from "./components/ArraysVisualizer";
import LinkedListVisualizer from "./components/LinkedListVisualizer";
import StacksQueuesVisualizer from "./components/StacksQueuesVisualizer";
import TreesVisualizer from "./components/TreesVisualizer";
import GraphExplorer from "./components/GraphExplorer";
import "./App.css";

const initialValues = [42, 72, 34, 88, 56, 24, 65, 48, 92, 38, 61, 29];

function generateArray(): number[] {
  const length = Math.floor(Math.random() * 13) + 8;
  return Array.from({ length }, () => Math.floor(Math.random() * 90) + 10);
}

function App() {
  const [activeSection, setActiveSection] = useState<
    "sorting" | "structures" | "graphs"
  >("sorting");
  const [activeStructure, setActiveStructure] = useState<
    "arrays" | "linked-lists" | "stacks-queues" | "trees"
  >("arrays");
  const [values, setValues] = useState(initialValues);
  const [activeAlgorithm, setActiveAlgorithm] =
    useState<SortingAlgorithm>("Bubble Sort");
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const sorting = useMemo(
    () =>
      activeAlgorithm === "Bubble Sort"
        ? bubbleSort(values)
        : activeAlgorithm === "Selection Sort"
          ? selectionSort(values)
          : activeAlgorithm === "Insertion Sort"
            ? insertionSort(values)
            : activeAlgorithm === "Merge Sort"
              ? mergeSort(values)
              : quickSort(values),
    [activeAlgorithm, values],
  );
  const replay = replaySortingEvents(
    values,
    sorting.events,
    step,
    activeAlgorithm,
  );
  const {
    values: currentValues,
    comparisons,
    swaps,
    movements,
    minimumIndex,
    keyIndex,
    heldKey,
    mergeRange,
    partitionRange,
    pivotIndex,
    pivotValue,
    partitionBoundary,
    sortedIndices,
    activeEvent,
    activeIndices,
  } = replay;
  const isComplete = step === sorting.events.length;
  const progress = sorting.events.length
    ? (step / sorting.events.length) * 100
    : 0;

  useEffect(() => {
    if (!isPlaying || step >= sorting.events.length) return;

    const timeout = window.setTimeout(() => {
      const nextStep = Math.min(step + 1, sorting.events.length);
      setStep(nextStep);
      if (nextStep >= sorting.events.length) setIsPlaying(false);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [isPlaying, step, sorting.events.length]);

  function resetVisualization() {
    setIsPlaying(false);
    setStep(0);
  }

  function generateNewArray() {
    setIsPlaying(false);
    setValues(generateArray());
    setStep(0);
  }

  function stepForward() {
    setIsPlaying(false);
    setStep((currentStep) =>
      Math.min(currentStep + 1, sorting.events.length),
    );
  }

  function stepBackward() {
    setIsPlaying(false);
    setStep((currentStep) => Math.max(currentStep - 1, 0));
  }

  function changeAlgorithm(algorithm: SortingAlgorithm) {
    setIsPlaying(false);
    setStep(0);
    setActiveAlgorithm(algorithm);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="AlgoCanvas home">
          <img className="brand-logo" src="/logo.svg" alt="AlgoCanvas" />
        </a>

        <div className="nav-label">WORKSPACE</div>

        <nav className="navigation" aria-label="Main navigation">
          <a
            className={`nav-item${activeSection === "sorting" ? " active" : ""}`}
            href="#sorting"
            aria-current={activeSection === "sorting" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActiveSection("sorting");
            }}
          >
            <span>▥</span> Sorting Lab
          </a>
          <a
            className={`nav-item${activeSection === "structures" ? " active" : ""}`}
            href="#structures"
            aria-current={activeSection === "structures" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActiveSection("structures");
            }}
          >
            <span>▤</span> Data Structures
          </a>
          <a
            className={`nav-item${activeSection === "graphs" ? " active" : ""}`}
            href="#graphs"
            aria-current={activeSection === "graphs" ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActiveSection("graphs");
            }}
          >
            <span>⌘</span> Graph Explorer
          </a>
          <a className="nav-item" href="#learn">
            <span>◉</span> Learn
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>Workspace ready</span>
          <span className="version">v0.1</span>
        </div>
      </aside>

      <main
        className="main-content"
        id={activeSection === "sorting" ? "sorting" : activeSection}
      >
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              Workspace / {activeSection === "sorting"
                ? "Sorting Lab"
                : activeSection === "structures"
                  ? "Data Structures"
                  : "Graph Explorer"}
            </div>
            <h1>
              {activeSection === "graphs"
                ? "Graph Algorithms Lab"
                : activeSection === "sorting"
                  ? "Algorithm playground"
                  : activeStructure === "arrays"
                  ? "Arrays"
                  : activeStructure === "linked-lists"
                    ? "Singly Linked Lists"
                    : activeStructure === "stacks-queues"
                      ? "Stacks & Queues"
                      : "Trees"}
            </h1>
          </div>
          <div className="header-right">
            <span className="engine-status">
              <span className="status-dot" />
              Preview mode
            </span>
            <div className="avatar" aria-label="User profile">S</div>
          </div>
        </header>

        {activeSection === "graphs" ? (
          <GraphExplorer />
        ) : activeSection === "structures" ? (
          <>
            <nav className="structure-tabs" aria-label="Data structure modules">
              <button
                className={`structure-tab${activeStructure === "arrays" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "arrays"}
                onClick={() => setActiveStructure("arrays")}
              >
                Arrays
              </button>
              <button
                className={`structure-tab${activeStructure === "linked-lists" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "linked-lists"}
                onClick={() => setActiveStructure("linked-lists")}
              >
                Linked Lists
              </button>
              <button
                className={`structure-tab${activeStructure === "stacks-queues" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "stacks-queues"}
                onClick={() => setActiveStructure("stacks-queues")}
              >
                Stacks &amp; Queues
              </button>
              <button
                className={`structure-tab${activeStructure === "trees" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "trees"}
                onClick={() => setActiveStructure("trees")}
              >
                Trees
              </button>
            </nav>
            {activeStructure === "arrays" ? (
              <ArraysVisualizer />
            ) : activeStructure === "linked-lists" ? (
              <LinkedListVisualizer />
            ) : activeStructure === "stacks-queues" ? (
              <StacksQueuesVisualizer />
            ) : (
              <TreesVisualizer />
            )}
          </>
        ) : (
          <>
        <section className="intro">
          <div>
            <div className="eyebrow">LEARN BY VISUALIZING</div>
            <h2>Make algorithms <span>click.</span></h2>
            <p>Explore the logic behind every comparison, swap, and decision.</p>
          </div>
          <div className="intro-decoration" aria-hidden="true">
            <span>01</span>
            <div className="decoration-line" />
            <span>∞</span>
          </div>
        </section>

        <section className="workspace-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">SORTING LAB</div>
              <h3>Visualize a sorting algorithm</h3>
            </div>
            <span className="complexity-badge">
              TIME ·{" "}
              {activeAlgorithm === "Merge Sort"
                ? "O(n log n)"
                : activeAlgorithm === "Quick Sort"
                  ? "O(n²) WORST"
                  : "O(n²)"}
            </span>
          </div>

          <div className="toolbar">
            <label className="select-label" htmlFor="algorithm">
              Algorithm
              <select
                id="algorithm"
                value={activeAlgorithm}
                aria-describedby="algorithm-availability"
                onChange={(event) => {
                  const algorithm = event.target.value;
                  if (
                    algorithm === "Bubble Sort" ||
                    algorithm === "Selection Sort" ||
                    algorithm === "Insertion Sort" ||
                    algorithm === "Merge Sort" ||
                    algorithm === "Quick Sort"
                  ) {
                    changeAlgorithm(algorithm);
                  }
                }}
              >
                <option value="Bubble Sort">Bubble Sort</option>
                <option value="Selection Sort">Selection Sort</option>
                <option value="Insertion Sort">Insertion Sort</option>
                <option value="Merge Sort">Merge Sort</option>
                <option value="Quick Sort">Quick Sort</option>
              </select>
              <span id="algorithm-availability" className="visually-hidden">
                Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, and Quick Sort are available.
              </span>
            </label>

            <button
              className="secondary-button"
              onClick={generateNewArray}
            >
              ↻ Shuffle / Generate Array
            </button>
            <button className="secondary-button" onClick={resetVisualization}>
              Reset
            </button>
          </div>

          <div className="visualization-area">
            <div className="canvas-topline">
              <span>ARRAY VISUALIZATION</span>
              <span>
                {heldKey !== undefined
                  ? `KEY: ${heldKey} · ${values.length} ELEMENTS`
                  : mergeRange
                    ? `MERGING ${mergeRange.start}–${mergeRange.end}`
                    : partitionRange
                      ? `PARTITION ${partitionRange.start}–${partitionRange.end}${pivotValue !== undefined ? ` · PIVOT ${pivotValue}` : ""}`
                  : `${values.length} ELEMENTS`}
              </span>
            </div>

            <div
              className="bars"
              role="group"
              aria-label={`${activeAlgorithm} array visualization`}
            >
              {currentValues.map((value, index) => {
                const isActive = activeIndices.includes(index);
                const inMergeRange =
                  mergeRange !== undefined &&
                  index >= mergeRange.start &&
                  index <= mergeRange.end;
                const inDivideRange =
                  activeEvent?.type === "divide" &&
                  index >= activeEvent.start &&
                  index <= activeEvent.end;
                const inPartitionRange =
                  partitionRange !== undefined &&
                  index >= partitionRange.start &&
                  index <= partitionRange.end;
                const barClass =
                isComplete
                    ? "bar-sorted"
                    : activeEvent?.type === "compare" &&
                        isActive &&
                        index !== pivotIndex
                      ? "bar-comparing"
                      : activeEvent?.type === "swap" && isActive
                        ? "bar-swapping"
                        : activeEvent?.type === "compare" &&
                            inPartitionRange &&
                            index !== pivotIndex
                          ? "bar-comparing"
                        : activeEvent?.type === "shift" && isActive
                          ? "bar-shifting"
                          : (activeEvent?.type === "write" ||
                                activeEvent?.type === "mergeWrite") &&
                              isActive
                            ? "bar-writing"
                            : inMergeRange
                              ? "bar-merging"
                                : inPartitionRange && index === pivotIndex
                                  ? "bar-pivot"
                                  : inPartitionRange && index === partitionBoundary
                                    ? "bar-boundary"
                                : inPartitionRange
                                  ? "bar-partition"
                                : sortedIndices.has(index)
                                  ? "bar-sorted"
                                : inDivideRange
                                  ? "bar-dividing"
                                : index === minimumIndex
                                  ? "bar-minimum"
                                  : index === keyIndex
                                    ? "bar-key"
                                    : index === pivotIndex
                                      ? "bar-pivot"
                                      : index === partitionBoundary && inPartitionRange
                                        ? "bar-boundary"
                                    : isActive
                                      ? "bar-comparing"
                                      : "";

                return (
                  <div className="bar-column" key={index}>
                    <div
                      className={`bar ${barClass}${value === undefined ? " bar-empty" : ""}`}
                      style={{
                        height: `${value === undefined ? 4 : Math.max(8, value)}%`,
                      }}
                      role="img"
                      aria-label={`Index ${index}, ${value === undefined ? "empty insertion position" : `value ${value}`}${sortedIndices.has(index) || isComplete ? ", sorted" : ""}${index === minimumIndex ? ", current minimum" : ""}${index === keyIndex ? ", insertion key held" : ""}${index === pivotIndex ? ", pivot" : ""}${index === partitionBoundary && inPartitionRange ? ", partition boundary" : ""}`}
                    >
                      {value !== undefined && <span>{value}</span>}
                    </div>
                    <span className="bar-index">{index}</span>
                  </div>
                );
              })}
            </div>

            <div className="legend">
              <span><i className="legend-default" /> Unsorted</span>
              <span><i className="legend-comparing" /> Comparing</span>
              <span><i className="legend-swapping" /> Swapping</span>
              {activeAlgorithm === "Insertion Sort" && (
                <>
                  <span><i className="legend-key" /> Insertion key</span>
                  <span><i className="legend-shifting" /> Shifting</span>
                </>
              )}
              {activeAlgorithm === "Merge Sort" && (
                <>
                  <span><i className="legend-dividing" /> Divide range</span>
                  <span><i className="legend-merging" /> Active merge</span>
                </>
              )}
              {activeAlgorithm === "Quick Sort" && (
                <>
                  <span><i className="legend-pivot" /> Pivot</span>
                  <span><i className="legend-boundary" /> Partition boundary</span>
                  <span><i className="legend-dividing" /> Active partition</span>
                </>
              )}
              <span><i className="legend-sorted" /> Sorted</span>
            </div>
          </div>

          <div className="playback">
            <div className="playback-buttons">
              <button
                className="icon-button"
                onClick={stepBackward}
                disabled={step === 0}
                aria-label="Step backward"
              >
                |◀
              </button>
              <button
                className="play-button"
                onClick={() => setIsPlaying((playing) => !playing)}
                disabled={!isPlaying && isComplete}
                aria-label={isPlaying ? "Pause animation" : "Play animation"}
              >
                {isPlaying ? "Ⅱ" : "▶"}
              </button>
              <button
                className="icon-button"
                onClick={stepForward}
                disabled={isComplete}
                aria-label="Step forward"
              >
                ▶|
              </button>
            </div>
            <div className="progress-section">
              <div className="progress-label">
                <span>Visualization progress</span>
                <span aria-live="polite">
                  {isComplete
                    ? "Complete"
                    : step === 0
                      ? "Ready to begin"
                      : `Step ${step} of ${sorting.events.length}`}
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Visualization progress"
                aria-valuemin={0}
                aria-valuemax={sorting.events.length}
                aria-valuenow={step}
              >
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="step-count">
              STEP {step} / {sorting.events.length}
            </span>
          </div>
        </section>

        <section className="info-grid">
          <article className="info-card">
            <span className="info-icon violet">⌘</span>
            <div>
              <span className="info-label">COMPARISONS</span>
              <strong>{comparisons}</strong>
              <p>Element comparisons</p>
            </div>
          </article>
          <article className="info-card">
            <span className="info-icon cyan">⇄</span>
            <div>
              <span className="info-label">
                {activeAlgorithm === "Insertion Sort" ||
                activeAlgorithm === "Merge Sort"
                  ? "MOVEMENTS"
                  : "SWAPS"}
              </span>
              <strong>
                {activeAlgorithm === "Insertion Sort" ||
                activeAlgorithm === "Merge Sort"
                  ? movements
                  : swaps}
              </strong>
              <p>
                {activeAlgorithm === "Insertion Sort"
                  ? "Shifts and key writes"
                  : activeAlgorithm === "Merge Sort"
                    ? "Values written during merges"
                    : "Positions exchanged"}
              </p>
            </div>
          </article>
          <article className="info-card">
            <span className="info-icon amber">◷</span>
            <div>
              <span className="info-label">COMPLEXITY</span>
              <strong>
                {activeAlgorithm === "Merge Sort"
                    ? "O(n log n)"
                    : activeAlgorithm === "Quick Sort"
                      ? "O(n²) worst"
                      : "O(n²)"}
              </strong>
              <p>
                {activeAlgorithm === "Merge Sort"
                    ? "Best, average & worst case"
                    : activeAlgorithm === "Quick Sort"
                      ? "Best/average O(n log n) · worst O(n²)"
                      : activeAlgorithm === "Selection Sort"
                        ? "Best, average & worst case"
                        : "Best O(n) · average/worst O(n²)"}
              </p>
            </div>
          </article>
        </section>

        <footer className="footer">
          <span>ALGOCANVAS <span className="footer-separator">/</span> BUILT TO UNDERSTAND</span>
          <span>More than code. A way to see it.</span>
        </footer>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
