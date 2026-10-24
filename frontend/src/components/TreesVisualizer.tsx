import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  createBST,
  deleteBST,
  getTreeNodeInfo,
  insertBST,
  parseTreeInteger,
  searchBST,
  traverseTree,
  treeHeight,
  treeNodeCount,
  type TreeNode,
  type TreeTraversal,
} from "../dataStructures/tree";
import "./TreesVisualizer.css";

const sampleValues = [50, 30, 70, 20, 40, 60, 80];
const traversalInterval = 650;

type PositionedNode = {
  value: number;
  x: number;
  y: number;
  depth: number;
  parent: number | null;
};

function layoutTree(root: TreeNode | null): {
  nodes: PositionedNode[];
  width: number;
  height: number;
} {
  const inOrder: Omit<PositionedNode, "x">[] = [];
  function visit(node: TreeNode | null, depth: number, parent: number | null): void {
    if (node === null) return;
    visit(node.left, depth + 1, node.value);
    inOrder.push({ value: node.value, y: 48 + depth * 94, depth, parent });
    visit(node.right, depth + 1, node.value);
  }
  visit(root, 0, null);

  const width = Math.max(720, (inOrder.length + 1) * 84);
  const nodes = inOrder.map((node, index) => ({
    ...node,
    x: ((index + 1) * width) / (inOrder.length + 1),
  }));
  const height = Math.max(150, (treeHeight(root) + 1) * 94 + 32);
  return { nodes, width, height };
}

function isTreeTraversal(value: string): value is TreeTraversal {
  return (
    value === "preorder" ||
    value === "inorder" ||
    value === "postorder" ||
    value === "level-order"
  );
}

function TreesVisualizer() {
  const [root, setRoot] = useState<TreeNode | null>(() => createBST(sampleValues));
  const [valueInput, setValueInput] = useState("");
  const [selectedValue, setSelectedValue] = useState<number | null>(null);
  const [visitedValues, setVisitedValues] = useState<readonly number[]>([]);
  const [status, setStatus] = useState(
    "Ready. Select a node, perform a BST operation, or start a traversal.",
  );
  const [traversal, setTraversal] = useState<TreeTraversal>("inorder");
  const [traversalValues, setTraversalValues] = useState<number[]>([]);
  const [traversalIndex, setTraversalIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  const { nodes, width, height } = useMemo(() => layoutTree(root), [root]);
  const nodesByValue = useMemo(
    () => new Map(nodes.map((node) => [node.value, node])),
    [nodes],
  );
  const selectedInfo = selectedValue === null
    ? null
    : getTreeNodeInfo(root, selectedValue);
  const currentTraversalValue = traversalValues[traversalIndex] ?? null;
  const traversalVisited = traversalIndex >= 0
    ? traversalValues.slice(0, traversalIndex + 1)
    : [];
  const highlightedValues = new Set([...visitedValues, ...traversalVisited]);
  const isTraversalReady = traversalValues.length > 0;
  const isTraversalComplete =
    isTraversalReady && traversalIndex >= traversalValues.length - 1;

  useEffect(() => {
    if (!isPlaying || traversalIndex < 0) return;
    const timeout = window.setTimeout(() => {
      const nextIndex = traversalIndex + 1;
      if (nextIndex >= traversalValues.length) {
        setIsPlaying(false);
        setStatus(`${traversalLabel(traversal)} traversal complete.`);
        return;
      }
      setTraversalIndex(nextIndex);
      setStatus(
        `${traversalLabel(traversal)}: visiting ${traversalValues[nextIndex]} (${nextIndex + 1} of ${traversalValues.length}).`,
      );
    }, traversalInterval);
    return () => window.clearTimeout(timeout);
  }, [isPlaying, traversal, traversalIndex, traversalValues]);

  function resetTraversal() {
    setIsPlaying(false);
    setTraversalValues([]);
    setTraversalIndex(-1);
  }

  function traversalLabel(selected: TreeTraversal): string {
    return selected === "level-order"
      ? "Level-order"
      : `${selected[0].toUpperCase()}${selected.slice(1)}`;
  }

  function applyOperationResult(
    visited: readonly number[],
    message: string,
    selected: number | null = null,
  ) {
    resetTraversal();
    setVisitedValues(visited);
    setSelectedValue(selected);
    setStatus(message);
  }

  function readInput(): number | null {
    const value = parseTreeInteger(valueInput);
    if (value === null) {
      applyOperationResult([], "Enter a valid safe whole-number value.");
      return null;
    }
    return value;
  }

  function handleInsert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = readInput();
    if (value === null) return;
    const result = insertBST(root, value);
    applyOperationResult(result.visited, result.message, result.ok ? value : null);
    if (result.ok) setRoot(result.value);
  }

  function handleSearch() {
    const value = readInput();
    if (value === null) return;
    const result = searchBST(root, value);
    applyOperationResult(
      result.visited,
      result.message,
      result.ok ? result.value : null,
    );
  }

  function handleDelete() {
    const value = readInput();
    if (value === null) return;
    const result = deleteBST(root, value);
    applyOperationResult(result.visited, result.message);
    if (result.ok) setRoot(result.value);
  }

  function resetSample() {
    resetTraversal();
    setRoot(createBST(sampleValues));
    setVisitedValues([]);
    setSelectedValue(null);
    setStatus("Restored the sample BST: 50, 30, 70, 20, 40, 60, 80.");
  }

  function selectNode(value: number) {
    resetTraversal();
    setVisitedValues([]);
    setSelectedValue(value);
    setStatus(`Selected node ${value}. Its parent, children, depth, and height are shown below.`);
  }

  function onNodeKeyDown(event: KeyboardEvent<SVGGElement>, value: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectNode(value);
    }
  }

  function startTraversal() {
    const nextOrder = traverseTree(root, traversal);
    if (nextOrder.length === 0) {
      setStatus("The tree is empty. Insert a value before starting a traversal.");
      setIsPlaying(false);
      return;
    }
    setVisitedValues([]);
    setSelectedValue(null);
    setTraversalValues(nextOrder);
    setTraversalIndex(0);
    setIsPlaying(nextOrder.length > 1);
    setStatus(
      `${traversalLabel(traversal)}: visiting ${nextOrder[0]} (1 of ${nextOrder.length}).`,
    );
  }

  function playTraversal() {
    if (!isTraversalReady) {
      startTraversal();
      return;
    }
    if (isTraversalComplete) {
      setStatus("Traversal is complete. Reset it to play again.");
      return;
    }
    setIsPlaying(true);
  }

  function stepTraversal() {
    if (!isTraversalReady) {
      const nextOrder = traverseTree(root, traversal);
      if (nextOrder.length === 0) {
        setStatus("The tree is empty. Insert a value before traversing.");
        return;
      }
      setVisitedValues([]);
      setSelectedValue(null);
      setTraversalValues(nextOrder);
      setTraversalIndex(0);
      setIsPlaying(false);
      setStatus(
        `${traversalLabel(traversal)}: visiting ${nextOrder[0]} (1 of ${nextOrder.length}).`,
      );
      return;
    }
    setIsPlaying(false);
    if (isTraversalComplete) return;
    const nextIndex = traversalIndex + 1;
    setTraversalIndex(nextIndex);
    setStatus(
      `${traversalLabel(traversal)}: visiting ${traversalValues[nextIndex]} (${nextIndex + 1} of ${traversalValues.length}).`,
    );
  }

  function changeTraversal(nextTraversal: TreeTraversal) {
    resetTraversal();
    setTraversal(nextTraversal);
    setVisitedValues([]);
    setSelectedValue(null);
    setStatus(`${traversalLabel(nextTraversal)} traversal selected.`);
  }

  return (
    <div className="trees-page">
      <section className="trees-intro">
        <div className="eyebrow">DATA STRUCTURES / HIERARCHICAL DATA</div>
        <p>
          Explore parent-child relationships, binary search tree operations,
          and four ways to visit every node.
        </p>
      </section>

      <section className="workspace-card trees-workspace">
        <div className="section-heading">
          <div>
            <div className="eyebrow">BINARY TREE &amp; BST VISUALIZER</div>
            <h3>Explore the tree, one node at a time</h3>
          </div>
          <span className="complexity-badge">
            {treeNodeCount(root)} NODES · HEIGHT {root === null ? "—" : treeHeight(root)}
          </span>
        </div>

        <div className="trees-toolbar">
          <button className="secondary-button" type="button" onClick={resetSample}>
            Reset sample tree
          </button>
          <span className="trees-duplicate-policy">
            Duplicate values are rejected
          </span>
        </div>

        <div className="trees-visualization">
          <div className="canvas-topline">
            <span>NODE LINKS · LEFT CHILD / RIGHT CHILD</span>
            <span>HEIGHT AND DEPTH COUNT EDGES</span>
          </div>
          {root === null ? (
            <div className="trees-empty">
              The tree is empty. Insert a value to create its root node.
            </div>
          ) : (
            <div
              className="trees-canvas-scroll"
              role="region"
              aria-label="Interactive binary search tree"
              tabIndex={0}
            >
              <svg
                className="trees-canvas"
                width={Math.max(width, 720)}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="group"
                aria-label={`Binary search tree with ${nodes.length} nodes and height ${treeHeight(root)} edges`}
              >
                {nodes.map((node) => {
                  if (node.parent === null) return null;
                  const parent = nodesByValue.get(node.parent);
                  if (!parent) return null;
                  return (
                    <line
                      className="tree-edge"
                      key={`edge-${node.parent}-${node.value}`}
                      x1={parent.x}
                      y1={parent.y + 24}
                      x2={node.x}
                      y2={node.y - 24}
                    />
                  );
                })}
                {nodes.map((node) => {
                  const isSelected = node.value === selectedValue;
                  const isCurrent = node.value === currentTraversalValue;
                  const isVisited = highlightedValues.has(node.value);
                  const className = [
                    "tree-node",
                    isVisited ? "is-visited" : "",
                    isSelected ? "is-selected" : "",
                    isCurrent ? "is-current" : "",
                  ].filter(Boolean).join(" ");
                  return (
                    <g
                      className={className}
                      key={`node-${node.value}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Tree node ${node.value}, depth ${node.depth}${isSelected ? ", selected" : ""}${isCurrent ? ", current traversal node" : ""}`}
                      onClick={() => selectNode(node.value)}
                      onKeyDown={(event) => onNodeKeyDown(event, node.value)}
                    >
                      <circle cx={node.x} cy={node.y} r="23" />
                      <text x={node.x} y={node.y + 5}>{node.value}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        <div className="trees-status" role="status" aria-live="polite">
          <span className="array-status-dot" aria-hidden="true" />
          <span>{status}</span>
          {visitedValues.length > 0 && (
            <strong className="trees-visited">
              Visited: {visitedValues.join(" → ")}
            </strong>
          )}
        </div>

        <form className="trees-operations" onSubmit={handleInsert}>
          <label htmlFor="tree-value">Whole-number value</label>
          <input
            id="tree-value"
            type="number"
            step="1"
            value={valueInput}
            onChange={(event) => setValueInput(event.target.value)}
            placeholder="e.g. 45"
          />
          <button className="array-action-button" type="submit">Insert</button>
          <button className="array-action-button" type="button" onClick={handleSearch}>Search</button>
          <button className="array-action-button" type="button" onClick={handleDelete}>Delete</button>
        </form>

        <section className="tree-node-details" aria-label="Selected node properties">
          <div className="eyebrow">SELECTED NODE</div>
          {selectedInfo === null ? (
            <p>Select a node in the tree to inspect its properties.</p>
          ) : (
            <dl className="tree-detail-list">
              <div><dt>Value</dt><dd>{selectedInfo.value}</dd></div>
              <div><dt>Parent</dt><dd>{selectedInfo.parent ?? "None (root)"}</dd></div>
              <div><dt>Left child</dt><dd>{selectedInfo.left ?? "None"}</dd></div>
              <div><dt>Right child</dt><dd>{selectedInfo.right ?? "None"}</dd></div>
              <div><dt>Depth</dt><dd>{selectedInfo.depth} edges</dd></div>
              <div><dt>Height</dt><dd>{selectedInfo.height} edges</dd></div>
              <div><dt>Leaf</dt><dd>{selectedInfo.isLeaf ? "Yes" : "No"}</dd></div>
            </dl>
          )}
        </section>

        <section className="tree-traversal" aria-label="Tree traversal controls">
          <div className="tree-traversal-select">
            <label htmlFor="tree-traversal">Traversal order</label>
            <select
              id="tree-traversal"
              value={traversal}
              onChange={(event) => {
                const nextTraversal = event.target.value;
                if (isTreeTraversal(nextTraversal)) changeTraversal(nextTraversal);
              }}
            >
              <option value="preorder">Preorder · Root, Left, Right</option>
              <option value="inorder">Inorder · Left, Root, Right</option>
              <option value="postorder">Postorder · Left, Right, Root</option>
              <option value="level-order">Level-order · Breadth-first</option>
            </select>
          </div>
          <div className="tree-traversal-readout" aria-live="polite">
            <span className="eyebrow">TRAVERSAL PROGRESS</span>
            <strong>
              {currentTraversalValue === null
                ? "Ready to traverse"
                : `Current node: ${currentTraversalValue}`}
            </strong>
            <span>
              {isTraversalReady
                ? `${Math.max(traversalIndex + 1, 0)} of ${traversalValues.length} nodes visited`
                : "Choose an order, then play or step through it."}
            </span>
          </div>
          <div className="tree-traversal-controls">
            <button
              className="array-play-button"
              type="button"
              onClick={playTraversal}
              disabled={nodes.length === 0 || isTraversalComplete}
              aria-label={isPlaying ? "Traversal is playing" : "Play traversal"}
            >
              ▶ Play
            </button>
            <button
              className="array-play-button"
              type="button"
              onClick={() => setIsPlaying(false)}
              disabled={!isPlaying}
              aria-label="Pause traversal"
            >
              Ⅱ Pause
            </button>
            <button
              className="array-step-button"
              type="button"
              onClick={stepTraversal}
              disabled={nodes.length === 0 || isTraversalComplete}
            >
              Step forward
            </button>
            <button
              className="array-step-button"
              type="button"
              onClick={() => {
                resetTraversal();
                setStatus(`${traversalLabel(traversal)} traversal reset.`);
              }}
            >
              Reset traversal
            </button>
          </div>
        </section>
      </section>

      <section className="array-learning trees-learning" aria-label="Tree concepts and complexities">
        <article className="array-learning-card">
          <div className="eyebrow">THE IDEA</div>
          <h3>Binary trees and BSTs</h3>
          <p>
            A <strong>root</strong> is the top node. A node’s <strong>parent</strong>
            connects to its <strong>children</strong> (at most two in a binary
            tree). A <strong>leaf</strong> has no children. <strong>Depth</strong>
            counts edges from the root; node <strong>height</strong> counts
            edges on its longest path down to a leaf.
          </p>
          <p>
            A binary tree limits each node to two children. A binary search tree
            (BST) also orders values: smaller values go left, larger values go
            right. This visualizer rejects duplicate values.
          </p>
        </article>

        <article className="array-learning-card">
          <div className="eyebrow">TRAVERSALS &amp; COMPLEXITY</div>
          <h3>Choose how to visit nodes</h3>
          <p>
            Preorder is useful for copying or serializing structure; inorder
            lists BST values in sorted order; postorder suits deleting a tree
            bottom-up; level-order visits breadth-first.
          </p>
          <dl className="array-complexities">
            <div><dt>Traversal</dt><dd>O(n)</dd></div>
            <div><dt>BST search / insert / delete</dt><dd>O(h)</dd></div>
            <div><dt>Unbalanced BST worst case</dt><dd>O(n)</dd></div>
          </dl>
          <p>
            Here h is the tree height. A balanced BST can take O(log n) per
            operation, but an unbalanced BST can take O(n); logarithmic time is
            not guaranteed.
          </p>
        </article>
      </section>
    </div>
  );
}

export default TreesVisualizer;
