import { useCallback, useEffect, useState, type FormEvent } from "react";
import "./ArraysVisualizer.css";

const initialArray = [10, 20, 30, 40, 50];
const maximumLength = 12;

function parseInteger(input: string): number | null {
  const trimmed = input.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

function ArraysVisualizer() {
  const [values, setValues] = useState(initialArray);
  const [accessIndex, setAccessIndex] = useState("");
  const [insertIndex, setInsertIndex] = useState("");
  const [insertValue, setInsertValue] = useState("");
  const [updateIndex, setUpdateIndex] = useState("");
  const [updateValue, setUpdateValue] = useState("");
  const [deleteIndex, setDeleteIndex] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [searchCursor, setSearchCursor] = useState(0);
  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);
  const [searchTarget, setSearchTarget] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackDelay, setPlaybackDelay] = useState(700);
  const [status, setStatus] = useState(
    "Ready. Choose an operation to explore how array indexes work.",
  );

  function stopSearch() {
    setIsSearching(false);
    setIsPlaying(false);
    setCheckedIndices([]);
    setSearchTarget(null);
  }

  const advanceSearch = useCallback(() => {
    if (!isSearching || searchTarget === null || values.length === 0) return;

    const currentIndex = searchCursor;
    const currentValue = values[currentIndex];
    setCheckedIndices((indices) => [...indices, currentIndex]);

    if (currentValue === searchTarget) {
      setSelectedIndex(currentIndex);
      setIsSearching(false);
      setIsPlaying(false);
      setStatus(`Found ${searchTarget} at index ${currentIndex}.`);
    } else if (currentIndex === values.length - 1) {
      setSelectedIndex(null);
      setIsSearching(false);
      setIsPlaying(false);
      setStatus(`${searchTarget} was not found after checking all ${values.length} elements.`);
    } else {
      const nextIndex = currentIndex + 1;
      setSearchCursor(nextIndex);
      setStatus(
        `Index ${currentIndex} contains ${currentValue}, not ${searchTarget}. Next, check index ${nextIndex}.`,
      );
    }
  }, [isSearching, searchCursor, searchTarget, values]);

  useEffect(() => {
    if (!isPlaying || !isSearching) return;

    const timeout = window.setTimeout(advanceSearch, playbackDelay);
    return () => window.clearTimeout(timeout);
  }, [advanceSearch, isPlaying, isSearching, playbackDelay]);

  function stepSearchForward() {
    setIsPlaying(false);
    advanceSearch();
  }

  function stepSearchBackward() {
    if (checkedIndices.length === 0 || searchTarget === null) return;
    setIsPlaying(false);
    const rewindIndex = checkedIndices[checkedIndices.length - 1];
    setCheckedIndices((indices) => indices.slice(0, -1));
    setSearchCursor(rewindIndex);
    setSelectedIndex(null);
    setIsSearching(true);
    setStatus(
      `Back at index ${rewindIndex}. Compare ${values[rewindIndex]} with ${searchTarget}.`,
    );
  }

  function resetSearch() {
    stopSearch();
    setSearchCursor(0);
    setSelectedIndex(null);
    setStatus("Search reset. Enter a target and start a new linear search.");
  }

  function handleAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const index = parseInteger(accessIndex);
    if (index === null || index < 0 || index >= values.length) {
      setStatus(
        values.length === 0
          ? "The array is empty. Add an element before accessing an index."
          : `Enter a whole-number index from 0 to ${values.length - 1}.`,
      );
      return;
    }

    stopSearch();
    setSelectedIndex(index);
    setStatus(`Accessed index ${index}: the value is ${values[index]}.`);
  }

  function handleInsert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseInteger(insertValue);
    const index = parseInteger(insertIndex);
    if (value === null) {
      setStatus("Enter a valid whole-number value to insert.");
      return;
    }
    if (index === null || index < 0 || index > values.length) {
      setStatus(`Enter a whole-number insertion index from 0 to ${values.length}.`);
      return;
    }
    if (values.length >= maximumLength) {
      setStatus(`The array is at its maximum length of ${maximumLength}.`);
      return;
    }

    stopSearch();
    setValues((current) => [
      ...current.slice(0, index),
      value,
      ...current.slice(index),
    ]);
    setSelectedIndex(index);
    setStatus(`Inserted ${value} at index ${index}. Elements at and after it shifted right.`);
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const index = parseInteger(updateIndex);
    const value = parseInteger(updateValue);
    if (index === null || index < 0 || index >= values.length) {
      setStatus(
        values.length === 0
          ? "The array is empty. Add an element before updating an index."
          : `Enter a whole-number index from 0 to ${values.length - 1}.`,
      );
      return;
    }
    if (value === null) {
      setStatus("Enter a valid whole-number value for the update.");
      return;
    }

    stopSearch();
    setValues((current) =>
      current.map((currentValue, currentIndex) =>
        currentIndex === index ? value : currentValue,
      ),
    );
    setSelectedIndex(index);
    setStatus(`Updated index ${index} to ${value}.`);
  }

  function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (values.length === 0) {
      setStatus("The array is empty. There is no element to delete.");
      return;
    }

    const index = parseInteger(deleteIndex);
    if (index === null || index < 0 || index >= values.length) {
      setStatus(`Enter a whole-number index from 0 to ${values.length - 1}.`);
      return;
    }

    const deletedValue = values[index];
    stopSearch();
    setValues((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setSelectedIndex(null);
    setStatus(`Deleted ${deletedValue} from index ${index}. Later elements shifted left.`);
  }

  function startSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = parseInteger(searchValue);
    if (target === null) {
      setStatus("Enter a valid whole-number target to search for.");
      return;
    }
    if (values.length === 0) {
      setStatus("The array is empty. Add an element before searching.");
      return;
    }

    setSelectedIndex(null);
    setCheckedIndices([]);
    setSearchTarget(target);
    setSearchCursor(0);
    setIsSearching(true);
    setIsPlaying(false);
    setStatus(`Search ready for ${target}. Step forward or play to begin at index 0.`);
  }

  function resetArray() {
    stopSearch();
    setValues([...initialArray]);
    setSelectedIndex(null);
    setStatus("Restored the sample array [10, 20, 30, 40, 50].");
  }

  function randomizeArray() {
    stopSearch();
    const length = Math.floor(Math.random() * 5) + 5;
    const randomized = Array.from(
      { length },
      () => Math.floor(Math.random() * 90) + 10,
    );
    setValues(randomized);
    setSelectedIndex(null);
    setStatus(`Generated a new array with ${length} random integers.`);
  }

  return (
    <div className="arrays-page">
      <section className="array-intro">
        <div className="eyebrow">DATA STRUCTURES / FUNDAMENTALS</div>
        <p>Understand how indexed data works through interactive operations.</p>
      </section>

      <section className="workspace-card arrays-workspace">
        <div className="section-heading">
          <div>
            <div className="eyebrow">ARRAY VISUALIZER</div>
            <h3>One value, one index</h3>
          </div>
          <span className="complexity-badge">
            {values.length} / {maximumLength} ELEMENTS
          </span>
        </div>

        <div className="array-toolbar">
          <button className="secondary-button" onClick={randomizeArray} type="button">
            ↻ Randomize
          </button>
          <button className="secondary-button" onClick={resetArray} type="button">
            Reset sample
          </button>
        </div>

        <div className="array-visualization">
          <div className="canvas-topline">
            <span>CONTIGUOUS INDEXED VALUES</span>
            <span>INDEX STARTS AT 0</span>
          </div>
          {values.length ? (
            <div className="array-cells" role="list" aria-label="Array elements">
              {values.map((value, index) => {
                const isCurrent = isSearching && searchCursor === index;
                const isChecked = checkedIndices.includes(index);
                const isSelected = !isSearching && selectedIndex === index;
                const cellClass = isCurrent
                  ? "array-cell is-current"
                  : isSelected
                    ? "array-cell is-selected"
                    : isChecked
                      ? "array-cell is-checked"
                      : "array-cell";

                return (
                  <div
                    className={cellClass}
                    key={`${index}-${value}`}
                    role="listitem"
                    aria-label={`Index ${index}, value ${value}${isCurrent ? ", current search position" : ""}${isSelected ? ", selected" : ""}${isChecked ? ", checked" : ""}`}
                  >
                    <span className="array-value">{value}</span>
                    <span className="array-index">{index}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="array-empty">The array is empty. Insert a value at index 0 to begin.</div>
          )}
        </div>

        <div className="array-status" role="status" aria-live="polite">
          <span className="array-status-dot" aria-hidden="true" />
          {status}
        </div>

        <div className="array-operations">
          <form className="array-operation" onSubmit={handleAccess}>
            <h4>Access by index</h4>
            <label htmlFor="array-access-index">Index</label>
            <input
              id="array-access-index"
              type="number"
              step="1"
              value={accessIndex}
              onChange={(event) => setAccessIndex(event.target.value)}
              placeholder="e.g. 2"
            />
            <button className="array-action-button" type="submit">Access</button>
          </form>

          <form className="array-operation" onSubmit={handleInsert}>
            <h4>Insert a value</h4>
            <label htmlFor="array-insert-value">Integer value</label>
            <input
              id="array-insert-value"
              type="number"
              step="1"
              value={insertValue}
              onChange={(event) => setInsertValue(event.target.value)}
              placeholder="e.g. 25"
            />
            <label htmlFor="array-insert-index">Insert at index</label>
            <input
              id="array-insert-index"
              type="number"
              step="1"
              value={insertIndex}
              onChange={(event) => setInsertIndex(event.target.value)}
              placeholder={`0 to ${values.length}`}
            />
            <button className="array-action-button" type="submit">Insert</button>
          </form>

          <form className="array-operation" onSubmit={handleUpdate}>
            <h4>Update a value</h4>
            <label htmlFor="array-update-index">Index</label>
            <input
              id="array-update-index"
              type="number"
              step="1"
              value={updateIndex}
              onChange={(event) => setUpdateIndex(event.target.value)}
              placeholder="e.g. 2"
            />
            <label htmlFor="array-update-value">New integer value</label>
            <input
              id="array-update-value"
              type="number"
              step="1"
              value={updateValue}
              onChange={(event) => setUpdateValue(event.target.value)}
              placeholder="e.g. 35"
            />
            <button className="array-action-button" type="submit">Update</button>
          </form>

          <form className="array-operation" onSubmit={handleDelete}>
            <h4>Delete by index</h4>
            <label htmlFor="array-delete-index">Index</label>
            <input
              id="array-delete-index"
              type="number"
              step="1"
              value={deleteIndex}
              onChange={(event) => setDeleteIndex(event.target.value)}
              placeholder="e.g. 2"
            />
            <button className="array-action-button" type="submit">Delete</button>
          </form>

          <form className="array-operation array-search-operation" onSubmit={startSearch}>
            <h4>Linear search</h4>
            <label htmlFor="array-search-value">Target integer</label>
            <input
              id="array-search-value"
              type="number"
              step="1"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="e.g. 30"
            />
            <div className="array-search-controls">
              <button className="array-action-button" type="submit" disabled={isSearching}>
                Start search
              </button>
              <button
                className="array-play-button"
                type="button"
                onClick={() => setIsPlaying((playing) => !playing)}
                disabled={!isSearching}
                aria-label={isPlaying ? "Pause linear search" : "Play linear search"}
              >
                {isPlaying ? "Ⅱ Pause" : "▶ Play"}
              </button>
              <button
                className="array-step-button"
                type="button"
                onClick={stepSearchBackward}
                disabled={checkedIndices.length === 0}
              >
                Previous
              </button>
              <button
                className="array-step-button"
                type="button"
                onClick={stepSearchForward}
                disabled={!isSearching}
              >
                Step forward
              </button>
              <button
                className="array-step-button"
                type="button"
                onClick={resetSearch}
                disabled={searchTarget === null && checkedIndices.length === 0}
              >
                Reset
              </button>
              <span className="array-search-step-count" aria-live="polite">
                Step {checkedIndices.length} of {values.length}
              </span>
              <label className="array-search-speed" htmlFor="array-search-speed">
                Speed
                <select
                  id="array-search-speed"
                  value={playbackDelay}
                  onChange={(event) => setPlaybackDelay(Number(event.target.value))}
                >
                  <option value={1400}>0.5×</option>
                  <option value={700}>1×</option>
                  <option value={350}>2×</option>
                </select>
              </label>
            </div>
          </form>
        </div>
      </section>

      <section className="array-learning" aria-label="Array concepts and complexities">
        <article className="array-learning-card array-explanation">
          <div className="eyebrow">THE IDEA</div>
          <h3>What is an array?</h3>
          <p>
            An array stores values in an ordered, contiguous sequence. Each value
            has an index, and indexing starts at 0 because the first position is
            zero offsets from the beginning.
          </p>
          <p>
            Direct access uses the index to locate a value, so it takes O(1)
            time. A linear search checks values one at a time, taking O(n) time
            in the worst case.
          </p>
        </article>

        <article className="array-learning-card array-complexity-card">
          <div className="eyebrow">TIME COMPLEXITY</div>
          <h3>Operation reference</h3>
          <dl className="array-complexities">
            <div><dt>Access by index</dt><dd>O(1)</dd></div>
            <div><dt>Search (linear)</dt><dd>O(n)</dd></div>
            <div><dt>Insert in middle</dt><dd>O(n)</dd></div>
            <div><dt>Delete in middle</dt><dd>O(n)</dd></div>
          </dl>
          <p>
            Middle insertions and deletions shift elements. Appending is
            typically amortized O(1); deleting the last element is O(1).
          </p>
        </article>
      </section>
    </div>
  );
}

export default ArraysVisualizer;
