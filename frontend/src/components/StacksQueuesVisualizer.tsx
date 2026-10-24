import { useState, type FormEvent } from "react";
import {
  createStack,
  createQueue,
  dequeue,
  enqueue,
  maximumQueueSize,
  maximumStackSize,
  parseStructureInteger,
  peekQueueFront,
  peekQueueRear,
  peekStack,
  popStack,
  pushStack,
  type QueueState,
  stackValues,
  type StackState,
} from "../dataStructures/stacksQueues";
import "./StacksQueuesVisualizer.css";

type StructureMode = "stack" | "queue";

const sampleStack = [10, 20, 30];
const sampleQueue = [10, 20, 30];

function StacksQueuesVisualizer() {
  const [mode, setMode] = useState<StructureMode>("stack");
  const [stack, setStack] = useState<StackState>(() => createStack(sampleStack));
  const [queue, setQueue] = useState<QueueState>(() =>
    createQueue(maximumQueueSize, sampleQueue),
  );
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState("Ready. Choose an operation to explore LIFO and FIFO.");
  const [result, setResult] = useState<number | null>(null);
  const [highlightedSlot, setHighlightedSlot] = useState<number | null>(null);
  const stackItems = stackValues(stack);

  function clearHighlight() {
    setHighlightedSlot(null);
  }

  function handlePush(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseStructureInteger(inputValue);
    if (value === null) {
      setResult(null);
      setStatus("Enter a valid whole-number value to push.");
      clearHighlight();
      return;
    }
    const operation = pushStack(stack, value);
    setStatus(operation.message);
    setResult(operation.ok ? value : null);
    if (operation.ok) {
      setStack(operation.value);
      setHighlightedSlot(0);
    } else {
      clearHighlight();
    }
  }

  function handlePop() {
    const operation = popStack(stack);
    setStatus(operation.message);
    setResult(operation.ok ? operation.value.value : null);
    if (operation.ok) {
      setStack(operation.value.stack);
      setHighlightedSlot(operation.value.stack.size > 0 ? 0 : null);
    } else {
      clearHighlight();
    }
  }

  function handlePeekStack() {
    const operation = peekStack(stack);
    setStatus(operation.message);
    setResult(operation.ok ? operation.value : null);
    setHighlightedSlot(operation.ok ? 0 : null);
  }

  function handleEnqueue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseStructureInteger(inputValue);
    if (value === null) {
      setResult(null);
      setStatus("Enter a valid whole-number value to enqueue.");
      clearHighlight();
      return;
    }
    const operation = enqueue(queue, value);
    setStatus(operation.message);
    setResult(operation.ok ? value : null);
    if (operation.ok) {
      setHighlightedSlot((queue.frontIndex + queue.size) % maximumQueueSize);
      setQueue(operation.value);
    } else {
      clearHighlight();
    }
  }

  function handleDequeue() {
    const operation = dequeue(queue);
    setStatus(operation.message);
    setResult(operation.ok ? operation.value.value : null);
    if (operation.ok) {
      setQueue(operation.value.queue);
      setHighlightedSlot(queue.frontIndex);
    } else {
      clearHighlight();
    }
  }

  function handlePeekQueueFront() {
    const operation = peekQueueFront(queue);
    setStatus(operation.message);
    setResult(operation.ok ? operation.value : null);
    setHighlightedSlot(operation.ok ? queue.frontIndex : null);
  }

  function handlePeekQueueRear() {
    const operation = peekQueueRear(queue);
    setStatus(operation.message);
    setResult(operation.ok ? operation.value : null);
    setHighlightedSlot(
      operation.ok
        ? (queue.frontIndex + queue.size - 1) % maximumQueueSize
        : null,
    );
  }

  function clearStructure() {
    clearHighlight();
    setResult(null);
    if (mode === "stack") {
      setStack(createStack());
      setStatus("Cleared the stack. It is now empty.");
    } else {
      setQueue(createQueue());
      setStatus("Cleared the queue. All circular-buffer slots are empty.");
    }
  }

  function resetSample() {
    clearHighlight();
    setResult(null);
    if (mode === "stack") {
      setStack(createStack(sampleStack));
      setStatus("Restored the sample stack: bottom 10, 20, top 30.");
    } else {
      setQueue(createQueue(maximumQueueSize, sampleQueue));
      setStatus("Restored the sample queue: front 10, 20, rear 30.");
    }
  }

  function changeMode(nextMode: StructureMode) {
    setMode(nextMode);
    setResult(null);
    clearHighlight();
    setStatus(
      nextMode === "stack"
        ? "Stack selected. The last value pushed is the first value popped."
        : "Queue selected. The first value enqueued is the first value dequeued.",
    );
  }

  const queueRearIndex = queue.size === 0
    ? null
    : (queue.frontIndex + queue.size - 1) % maximumQueueSize;

  return (
    <div className="stacks-queues-page">
      <section className="stacks-queues-intro">
        <div className="eyebrow">DATA STRUCTURES / LINEAR COLLECTIONS</div>
        <p>
          Compare two ways of ordering work: stacks remove the newest item first,
          while queues remove the oldest.
        </p>
      </section>

      <section className="workspace-card stacks-queues-workspace">
        <div className="section-heading">
          <div>
            <div className="eyebrow">STACKS &amp; QUEUES VISUALIZER</div>
            <h3>{mode === "stack" ? "Last in, first out" : "First in, first out"}</h3>
          </div>
          <span className="complexity-badge">
            {mode === "stack"
              ? `${stack.size} / ${maximumStackSize} ITEMS`
              : `${queue.size} / ${maximumQueueSize} ITEMS`}
          </span>
        </div>

        <div className="stacks-queues-mode" role="tablist" aria-label="Choose a data structure">
          <button
            className={`structure-tab${mode === "stack" ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={mode === "stack"}
            onClick={() => changeMode("stack")}
          >
            Stack
          </button>
          <button
            className={`structure-tab${mode === "queue" ? " active" : ""}`}
            type="button"
            role="tab"
            aria-selected={mode === "queue"}
            onClick={() => changeMode("queue")}
          >
            Queue
          </button>
        </div>

        <div className="stacks-queues-toolbar">
          {mode === "stack" ? (
            <form className="stacks-queues-input" onSubmit={handlePush}>
              <label htmlFor="stack-value">Integer value</label>
              <input
                id="stack-value"
                type="number"
                step="1"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="e.g. 40"
              />
              <button className="array-action-button" type="submit">Push</button>
            </form>
          ) : (
            <form className="stacks-queues-input" onSubmit={handleEnqueue}>
              <label htmlFor="queue-value">Integer value</label>
              <input
                id="queue-value"
                type="number"
                step="1"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder="e.g. 40"
              />
              <button className="array-action-button" type="submit">Enqueue</button>
            </form>
          )}
          <button
            className="secondary-button"
            type="button"
            onClick={clearStructure}
          >
            Clear {mode}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={resetSample}
          >
            Reset sample
          </button>
        </div>

        <div className="stacks-queues-visualization">
          <div className="canvas-topline">
            <span>{mode === "stack" ? "STACK · VERTICAL LIFO" : "CIRCULAR QUEUE · FIFO"}</span>
            <span>
              {mode === "stack"
                ? `TOP ${stack.size ? `· ${stack.top?.value}` : "· EMPTY"}`
                : `FRONT ${queue.size ? `· ${queue.slots[queue.frontIndex]}` : "· EMPTY"}  /  REAR ${queueRearIndex === null ? "· EMPTY" : `· ${queue.slots[queueRearIndex]}`}`}
            </span>
          </div>
          {mode === "stack" ? (
            stack.size ? (
              <ol className="stack-items" aria-label="Stack elements, top to bottom">
                {stackItems.map((value, index) => {
                  const isHighlighted = highlightedSlot === index;
                  return (
                    <li
                      className={`stack-item${isHighlighted ? " is-highlighted" : ""}`}
                      key={`${index}-${value}`}
                      aria-label={`${index === 0 ? "Top, " : ""}value ${value}`}
                    >
                      {index === 0 && <span className="stack-top-label">TOP</span>}
                      <strong>{value}</strong>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="stacks-queues-empty">Stack is empty. Push a value to place it at the top.</div>
            )
          ) : (
            <div
              className="queue-slots"
              role="list"
              aria-label="Circular queue slots from index zero"
            >
              {queue.slots.map((value, index) => {
                const isFront = queue.size > 0 && index === queue.frontIndex;
                const isRear = queue.size > 0 && index === queueRearIndex;
                const isHighlighted = highlightedSlot === index;
                return (
                  <div
                    className={`queue-slot${value === null ? " is-empty" : ""}${isHighlighted ? " is-highlighted" : ""}`}
                    key={index}
                    role="listitem"
                    aria-label={`Slot ${index}, ${value === null ? "empty" : `value ${value}`}${isFront ? ", front" : ""}${isRear ? ", rear" : ""}`}
                  >
                    <span className="queue-end-label">
                      {isFront && isRear ? "FRONT · REAR" : isFront ? "FRONT" : isRear ? "REAR" : "\u00a0"}
                    </span>
                    <strong>{value ?? "—"}</strong>
                    <span className="queue-slot-index">slot {index}</span>
                  </div>
                );
              })}
              {queue.size === 0 && (
                <p className="queue-empty-note">Queue is empty. New values enter at the rear.</p>
              )}
            </div>
          )}
        </div>

        <div className="stacks-queues-status" role="status" aria-live="polite">
          <span className="array-status-dot" aria-hidden="true" />
          <span>{status}</span>
          {result !== null && <strong className="operation-result">Result: {result}</strong>}
        </div>

        <div className="stacks-queues-actions">
          {mode === "stack" ? (
            <>
              <button className="array-action-button" type="button" onClick={handlePop}>Pop</button>
              <button className="array-action-button" type="button" onClick={handlePeekStack}>Peek top</button>
            </>
          ) : (
            <>
              <button className="array-action-button" type="button" onClick={handleDequeue}>Dequeue</button>
              <button className="array-action-button" type="button" onClick={handlePeekQueueFront}>Peek front</button>
              <button className="array-action-button" type="button" onClick={handlePeekQueueRear}>Peek rear</button>
            </>
          )}
        </div>
      </section>

      <section className="array-learning stacks-queues-learning" aria-label="Stack and queue concepts and complexities">
        <article className="array-learning-card">
          <div className="eyebrow">THE IDEA</div>
          <h3>LIFO versus FIFO</h3>
          <p>
            A stack is LIFO: <strong>Last In, First Out</strong>. The newest
            pushed value sits on top and is the next one popped. Stacks are
            useful for undo history, function calls, and reversing sequences.
          </p>
          <p>
            A queue is FIFO: <strong>First In, First Out</strong>. Enqueue at
            the rear and dequeue from the front. Queues are useful for task
            scheduling, print jobs, and breadth-first search.
          </p>
          <p>
            Both structures are bounded here to {maximumStackSize} items.
            Adding past capacity is overflow; removing or peeking while empty
            is underflow. The queue uses a circular buffer, so the rear wraps
            to the first slot when space is available.
          </p>
        </article>

        <article className="array-learning-card">
          <div className="eyebrow">TIME COMPLEXITY</div>
          <h3>Operation reference</h3>
          <dl className="array-complexities">
            <div><dt>Stack Push / Pop / Peek</dt><dd>O(1)</dd></div>
            <div><dt>Queue Enqueue / Dequeue</dt><dd>O(1)</dd></div>
            <div><dt>Queue Front / Rear</dt><dd>O(1)</dd></div>
            <div><dt>Clear stack</dt><dd>O(1)</dd></div>
            <div><dt>Clear queue</dt><dd>O(capacity)</dd></div>
          </dl>
          <p>
            Endpoint operations touch one slot in the bounded circular-buffer
            model. Clearing releases the stored elements.
          </p>
        </article>
      </section>
    </div>
  );
}

export default StacksQueuesVisualizer;
