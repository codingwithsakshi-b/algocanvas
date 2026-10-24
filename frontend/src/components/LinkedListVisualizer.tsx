import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  append,
  createLinkedList,
  deleteAt,
  deleteFirst,
  deleteLast,
  insertAt,
  linkedListNodes,
  maximumListLength,
  parseListInteger,
  prepend,
  updateAt,
  type LinkedListNode,
  type ListResult,
} from "../dataStructures/linkedList";
import "./LinkedListVisualizer.css";

const sampleValues = [10, 20, 30];

function LinkedListVisualizer() {
  const [nextNodeId, setNextNodeId] = useState(sampleValues.length + 1);
  const [head, setHead] = useState<LinkedListNode | null>(() =>
    createLinkedList(sampleValues),
  );
  const [beginningValue, setBeginningValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [insertValue, setInsertValue] = useState("");
  const [insertIndex, setInsertIndex] = useState("");
  const [deleteIndex, setDeleteIndex] = useState("");
  const [updateIndex, setUpdateIndex] = useState("");
  const [updateValue, setUpdateValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [traversalIndex, setTraversalIndex] = useState<number | null>(null);
  const [traversalTarget, setTraversalTarget] = useState<number | null>(null);
  const [isTraversing, setIsTraversing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [traversalFinished, setTraversalFinished] = useState(false);
  const [status, setStatus] = useState(
    "Ready. Start a traversal or choose an operation to explore the list.",
  );
  const nodes = useMemo(() => linkedListNodes(head), [head]);

  function stopTraversal() {
    setIsPlaying(false);
    setIsTraversing(false);
    setTraversalIndex(null);
    setTraversalTarget(null);
    setTraversalFinished(false);
  }

  function commitMutation(result: ListResult<LinkedListNode | null>, addedNode = false) {
    if (!result.ok) {
      setStatus(result.message);
      return;
    }

    stopTraversal();
    setHead(result.value);
    if (addedNode) setNextNodeId((id) => id + 1);
    setStatus(result.message);
  }

  function handleInsertBeginning(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseListInteger(beginningValue);
    if (value === null) {
      setStatus("Enter a valid whole-number value to insert at the beginning.");
      return;
    }
    commitMutation(prepend(head, value, nextNodeId), true);
  }

  function handleInsertEnd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseListInteger(endValue);
    if (value === null) {
      setStatus("Enter a valid whole-number value to insert at the end.");
      return;
    }
    commitMutation(append(head, value, nextNodeId), true);
  }

  function handleInsertAt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseListInteger(insertValue);
    const index = parseListInteger(insertIndex);
    if (value === null) {
      setStatus("Enter a valid whole-number value to insert.");
      return;
    }
    if (index === null) {
      setStatus("Enter a whole-number index for the insertion point.");
      return;
    }
    commitMutation(insertAt(head, value, index, nextNodeId), true);
  }

  function handleDeleteAt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const index = parseListInteger(deleteIndex);
    if (index === null) {
      setStatus("Enter a whole-number index for the node to delete.");
      return;
    }
    commitMutation(deleteAt(head, index));
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = parseListInteger(updateValue);
    const index = parseListInteger(updateIndex);
    if (index === null) {
      setStatus("Enter a whole-number index for the node to update.");
      return;
    }
    if (value === null) {
      setStatus("Enter a valid whole-number value for the update.");
      return;
    }
    commitMutation(updateAt(head, value, index));
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = parseListInteger(searchValue);
    if (target === null) {
      setStatus("Enter a valid whole-number value to search for.");
      return;
    }
    if (head === null) {
      setStatus(`${target} is not in the list because the list is empty.`);
      return;
    }

    setIsPlaying(false);
    setTraversalTarget(target);
    setTraversalIndex(0);
    setIsTraversing(true);
    setTraversalFinished(false);
    setStatus(`Search for ${target} starts at HEAD. Step or play to follow each next pointer.`);
  }

  const advanceTraversal = useCallback(() => {
    if (!isTraversing || traversalIndex === null) return;

    const currentNode = nodes[traversalIndex];
    if (currentNode === undefined) {
      setIsPlaying(false);
      setIsTraversing(false);
      setTraversalIndex(null);
      setTraversalFinished(true);
      setStatus("Traversal reached NULL.");
      return;
    }

    if (traversalTarget !== null && currentNode.value === traversalTarget) {
      setIsPlaying(false);
      setIsTraversing(false);
      setTraversalFinished(true);
      setStatus(`Found ${traversalTarget} at index ${traversalIndex}.`);
      return;
    }

    const nextIndex = traversalIndex + 1;
    if (nextIndex >= nodes.length) {
      setIsPlaying(false);
      setIsTraversing(false);
      setTraversalIndex(null);
      setTraversalFinished(true);
      setStatus(
        traversalTarget === null
          ? `Visited index ${traversalIndex}, value ${currentNode.value}. The next pointer is NULL; traversal is complete.`
          : `${traversalTarget} was not found. Traversal followed the list to NULL.`,
      );
      return;
    }

    const nextNode = nodes[nextIndex];
    setTraversalIndex(nextIndex);
    if (traversalTarget !== null && nextNode.value === traversalTarget) {
      setIsPlaying(false);
      setIsTraversing(false);
      setTraversalFinished(true);
      setStatus(`Found ${traversalTarget} at index ${nextIndex}.`);
      return;
    }
    setStatus(
      `Followed next from index ${traversalIndex} (${currentNode.value}) to index ${nextIndex} (${nextNode.value}).`,
    );
  }, [isTraversing, nodes, traversalIndex, traversalTarget]);

  useEffect(() => {
    if (!isPlaying || !isTraversing) return;

    const timeout = window.setTimeout(advanceTraversal, 750);
    return () => window.clearTimeout(timeout);
  }, [advanceTraversal, isPlaying, isTraversing]);

  function startTraversal() {
    if (head === null) {
      setStatus("The list is empty. HEAD points directly to NULL.");
      return;
    }

    setIsPlaying(false);
    setTraversalTarget(null);
    setTraversalIndex(0);
    setIsTraversing(true);
    setTraversalFinished(false);
    setStatus(`Traversal starts at HEAD: index 0, value ${nodes[0].value}.`);
  }

  function stepForward() {
    if (!isTraversing) {
      if (traversalFinished) return;
      startTraversal();
      return;
    }
    if (!isPlaying) advanceTraversal();
  }

  function resetSample() {
    stopTraversal();
    setHead(createLinkedList(sampleValues, nextNodeId));
    setNextNodeId((id) => id + sampleValues.length);
    setStatus("Restored the sample list: 10 → 20 → 30 → NULL.");
  }

  function clearList() {
    stopTraversal();
    setHead(null);
    setStatus("Cleared the list. HEAD now points directly to NULL.");
  }

  function resetSampleTraversal() {
    stopTraversal();
    setStatus("Traversal reset. Start again from HEAD when ready.");
  }

  const currentNode = traversalIndex === null ? null : nodes[traversalIndex] ?? null;

  return (
    <div className="linked-list-page">
      <section className="linked-list-intro">
        <div className="eyebrow">DATA STRUCTURES / POINTERS</div>
        <p>Follow each next pointer to see how a singly linked list connects its values.</p>
      </section>

      <section className="workspace-card linked-list-workspace">
        <div className="section-heading">
          <div>
            <div className="eyebrow">SINGLY LINKED LIST VISUALIZER</div>
            <h3>Each node points to the next</h3>
          </div>
          <span className="complexity-badge">
            {nodes.length} / {maximumListLength} NODES
          </span>
        </div>

        <div className="linked-list-toolbar">
          <button className="secondary-button" type="button" onClick={resetSample}>
            Reset sample
          </button>
          <button className="secondary-button" type="button" onClick={clearList}>
            Clear list
          </button>
        </div>

        <div className="linked-list-visualization">
          <div className="canvas-topline">
            <span>HEAD → NEXT → NEXT</span>
            <span>{nodes.length} {nodes.length === 1 ? "NODE" : "NODES"}</span>
          </div>
          <div
            className="linked-list-scroll"
            role="region"
            aria-label="Singly linked list visualization"
            tabIndex={0}
          >
            {nodes.length === 0 ? (
              <div className="linked-list-empty">
                <span className="linked-head-label">HEAD</span>
                <span className="linked-empty-arrow" aria-hidden="true">→</span>
                <span className="linked-null-label">NULL</span>
              </div>
            ) : (
              <ol className="linked-list-chain" aria-label="Linked list nodes">
                {nodes.map((node, index) => {
                  const isCurrent = traversalIndex === index;
                  return (
                    <Fragment key={node.id}>
                      <li
                        className={`linked-list-item${isCurrent ? " is-current" : ""}`}
                        aria-label={`Index ${index}, value ${node.value}${isCurrent ? ", current traversal node" : ""}`}
                      >
                        <span className="linked-head-label">
                          {index === 0 ? "HEAD" : "\u00a0"}
                        </span>
                        <div className="linked-node">
                          <div className="linked-node-value">
                            <span>VALUE</span>
                            <strong>{node.value}</strong>
                          </div>
                          <div className="linked-node-next">
                            <span>NEXT</span>
                            <strong>{node.next === null ? "NULL" : "•"}</strong>
                          </div>
                        </div>
                        <span className="linked-index">index {index}</span>
                      </li>
                      {index < nodes.length - 1 && (
                        <li
                          className="linked-connector"
                          role="presentation"
                          aria-hidden="true"
                        >
                          <span />
                        </li>
                      )}
                    </Fragment>
                  );
                })}
                <li className="linked-list-terminal" aria-label="List terminates at NULL">
                  <span className="linked-head-label">&nbsp;</span>
                  <span className="linked-null-label">NULL</span>
                  <span className="linked-index">&nbsp;</span>
                </li>
              </ol>
            )}
          </div>
        </div>

        <div className="linked-traversal-panel">
          <div className="linked-traversal-readout" aria-live="polite">
            <span className="eyebrow">TRAVERSAL</span>
            <strong>
              {currentNode === null
                ? nodes.length === 0 || traversalFinished
                  ? "At NULL"
                  : "Ready at HEAD"
                : `Index ${traversalIndex} · Value ${currentNode.value}`}
            </strong>
            <span>
              {currentNode === null
                ? "Follow next pointers from the head node."
                : traversalTarget === null
                  ? "Current node is highlighted."
                  : `Searching for ${traversalTarget}.`}
            </span>
          </div>
          <div className="linked-traversal-controls">
            <button
              className="array-play-button"
              type="button"
              onClick={() => {
                if (!isTraversing) {
                  if (traversalFinished) return;
                  startTraversal();
                  setIsPlaying(true);
                } else {
                  setIsPlaying((playing) => !playing);
                }
              }}
              disabled={nodes.length === 0 || traversalFinished}
              aria-label={isPlaying ? "Pause traversal" : "Play traversal"}
            >
              {isPlaying ? "Ⅱ Pause" : "▶ Play"}
            </button>
            <button
              className="array-step-button"
              type="button"
              onClick={stepForward}
              disabled={
                nodes.length === 0 ||
                isPlaying ||
                traversalFinished ||
                (isTraversing && !currentNode)
              }
            >
              Step forward
            </button>
            <button
              className="array-step-button"
              type="button"
              onClick={resetSampleTraversal}
            >
              Reset traversal
            </button>
          </div>
        </div>

        <div className="linked-list-status" role="status" aria-live="polite">
          <span className="array-status-dot" aria-hidden="true" />
          {status}
        </div>

        <div className="linked-list-operations">
          <form className="array-operation" onSubmit={handleInsertBeginning}>
            <h4>Insert at beginning</h4>
            <label htmlFor="list-prepend-value">Integer value</label>
            <input
              id="list-prepend-value"
              type="number"
              step="1"
              value={beginningValue}
              onChange={(event) => setBeginningValue(event.target.value)}
              placeholder="e.g. 5"
            />
            <button className="array-action-button" type="submit">Prepend</button>
          </form>

          <form className="array-operation" onSubmit={handleInsertEnd}>
            <h4>Insert at end</h4>
            <label htmlFor="list-append-value">Integer value</label>
            <input
              id="list-append-value"
              type="number"
              step="1"
              value={endValue}
              onChange={(event) => setEndValue(event.target.value)}
              placeholder="e.g. 40"
            />
            <button className="array-action-button" type="submit">Append</button>
          </form>

          <form className="array-operation" onSubmit={handleInsertAt}>
            <h4>Insert at index</h4>
            <label htmlFor="list-insert-value">Integer value</label>
            <input
              id="list-insert-value"
              type="number"
              step="1"
              value={insertValue}
              onChange={(event) => setInsertValue(event.target.value)}
              placeholder="e.g. 25"
            />
            <label htmlFor="list-insert-index">Index (0 to {nodes.length})</label>
            <input
              id="list-insert-index"
              type="number"
              step="1"
              value={insertIndex}
              onChange={(event) => setInsertIndex(event.target.value)}
              placeholder={`0 to ${nodes.length}`}
            />
            <button className="array-action-button" type="submit">Insert</button>
          </form>

          <form className="array-operation" onSubmit={handleDeleteAt}>
            <h4>Delete at index</h4>
            <label htmlFor="list-delete-index">Index (0 to {Math.max(nodes.length - 1, 0)})</label>
            <input
              id="list-delete-index"
              type="number"
              step="1"
              value={deleteIndex}
              onChange={(event) => setDeleteIndex(event.target.value)}
              placeholder="e.g. 1"
            />
            <button className="array-action-button" type="submit">Delete node</button>
          </form>

          <form className="array-operation" onSubmit={handleUpdate}>
            <h4>Update at index</h4>
            <label htmlFor="list-update-index">Index</label>
            <input
              id="list-update-index"
              type="number"
              step="1"
              value={updateIndex}
              onChange={(event) => setUpdateIndex(event.target.value)}
              placeholder="e.g. 1"
            />
            <label htmlFor="list-update-value">New integer value</label>
            <input
              id="list-update-value"
              type="number"
              step="1"
              value={updateValue}
              onChange={(event) => setUpdateValue(event.target.value)}
              placeholder="e.g. 25"
            />
            <button className="array-action-button" type="submit">Update node</button>
          </form>

          <form className="array-operation" onSubmit={handleSearch}>
            <h4>Search value</h4>
            <label htmlFor="list-search-value">Integer value</label>
            <input
              id="list-search-value"
              type="number"
              step="1"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="e.g. 20"
            />
            <button className="array-action-button" type="submit">Search from HEAD</button>
          </form>

          <div className="array-operation linked-quick-deletes">
            <h4>Quick delete</h4>
            <p>Remove an endpoint node directly.</p>
            <div className="linked-quick-delete-buttons">
              <button
                className="array-action-button"
                type="button"
                onClick={() => commitMutation(deleteFirst(head))}
              >
                Delete first
              </button>
              <button
                className="array-action-button"
                type="button"
                onClick={() => commitMutation(deleteLast(head))}
              >
                Delete last
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="array-learning linked-list-learning" aria-label="Linked list concepts and complexities">
        <article className="array-learning-card">
          <div className="eyebrow">THE IDEA</div>
          <h3>Nodes connected by pointers</h3>
          <p>
            A singly linked list is a sequence of nodes. Each node stores a value
            and a next pointer to the following node. HEAD identifies the first
            node; the last node points to NULL to mark the end.
          </p>
          <p>
            Unlike an array, nodes are linked through pointers rather than
            addressed by contiguous indexes. To reach a position, follow next
            from HEAD one node at a time.
          </p>
        </article>

        <article className="array-learning-card">
          <div className="eyebrow">TIME COMPLEXITY</div>
          <h3>Operation reference</h3>
          <dl className="array-complexities">
            <div><dt>Access by index</dt><dd>O(n)</dd></div>
            <div><dt>Search</dt><dd>O(n)</dd></div>
            <div><dt>Insert / delete at head</dt><dd>O(1)</dd></div>
            <div><dt>Insert / delete elsewhere</dt><dd>O(n)</dd></div>
          </dl>
          <p>
            Finding a position requires walking the list in O(n). Once the
            previous node is known, changing its next pointer is O(1); the
            overall indexed operation still includes the locating cost.
          </p>
        </article>
      </section>
    </div>
  );
}

export default LinkedListVisualizer;
