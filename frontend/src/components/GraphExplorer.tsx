import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  addEdge,
  addVertex,
  breadthFirstSearch,
  createGraph,
  depthFirstSearch,
  dijkstra,
  removeEdge,
  removeVertex,
  replayGraphEvents,
  setGraphMode,
  updateEdgeWeight,
  type GraphAlgorithm,
  type GraphAlgorithmResult,
  type GraphDefinition,
  type GraphEdge,
  type GraphOperationResult,
} from "../algorithms/graph";
import "./GraphExplorer.css";

interface GraphExplorerProps {
  algorithm: GraphAlgorithm;
  onTopicStart: (topicId: string) => void;
  onTopicComplete: (topicId: string) => void;
}

const sampleGraph = createGraph(
  ["A", "B", "C", "D", "E", "F"],
  [
    { from: "A", to: "B", weight: 4 },
    { from: "A", to: "C", weight: 2 },
    { from: "B", to: "D", weight: 5 },
    { from: "C", to: "D", weight: 1 },
    { from: "C", to: "E", weight: 6 },
    { from: "D", to: "E", weight: 3 },
    { from: "E", to: "F", weight: 2 },
  ],
  false,
  true,
);

function parseWeight(input: string): number | null {
  const value = Number(input);
  return input.trim() !== "" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function GraphExplorer({
  algorithm,
  onTopicStart,
  onTopicComplete,
}: GraphExplorerProps) {
  const [graph, setGraph] = useState<GraphDefinition>(sampleGraph);
  const [vertexName, setVertexName] = useState("");
  const [edgeFrom, setEdgeFrom] = useState("A");
  const [edgeTo, setEdgeTo] = useState("B");
  const [edgeWeight, setEdgeWeight] = useState("1");
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState(0);
  const [selectedVertex, setSelectedVertex] = useState<string | null>(null);
  const [startVertex, setStartVertex] = useState("A");
  const [destinationVertex, setDestinationVertex] = useState("F");
  const [result, setResult] = useState<GraphAlgorithmResult | null>(null);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackDelay, setPlaybackDelay] = useState(700);
  const [status, setStatus] = useState(
    "Ready. Add vertices and edges, or run an algorithm on the sample graph.",
  );
  const [directedMode, setDirectedMode] = useState(graph.directed);
  const [weightedMode, setWeightedMode] = useState(graph.weighted);

  const names = useMemo(
    () => graph.vertices.map((vertex) => vertex.name),
    [graph.vertices],
  );
  const current = replayGraphEvents(result?.events ?? [], step);
  const completed = result !== null && step >= result.events.length;
  const edgeKey = (edge: GraphEdge): string =>
    `${edge.from}\u0000${edge.to}`;
  const currentEdge = current.activeEdge;
  const pathEdgeKeys = useMemo(() => {
    const keys = new Set<string>();
    for (let index = 1; index < current.path.length; index += 1) {
      const from = current.path[index - 1];
      const to = current.path[index];
      const edge = graph.edges.find((item) =>
        item.from === from && item.to === to ||
        !graph.directed && item.from === to && item.to === from
      );
      if (edge) keys.add(edgeKey(edge));
    }
    return keys;
  }, [current.path, graph.directed, graph.edges]);

  useEffect(() => {
    if (!isPlaying || result === null) return;
    if (step >= result.events.length) return;
    const timeout = window.setTimeout(() => {
      const nextStep = Math.min(step + 1, result.events.length);
      setStep(nextStep);
      if (nextStep >= result.events.length) setIsPlaying(false);
      if (nextStep >= result.events.length) {
        onTopicComplete(`graphs-${result.algorithm}`);
      }
      setStatus(
        nextStep === result.events.length
          ? result.finalMessage
          : result.events[nextStep - 1].explanation,
      );
    }, playbackDelay);
    return () => window.clearTimeout(timeout);
  }, [isPlaying, onTopicComplete, playbackDelay, result, step]);

  function invalidatePlayback(message?: string) {
    setIsPlaying(false);
    setResult(null);
    setStep(0);
    if (message) setStatus(message);
  }

  function applyGraphResult(
    operation: GraphOperationResult<GraphDefinition>,
  ) {
    if (!operation.ok) {
      setStatus(operation.message);
      return;
    }
    setGraph(operation.value);
    setSelectedVertex(null);
    setSelectedEdgeIndex(0);
    invalidatePlayback(operation.message);
  }

  function handleAddVertex(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const operation = addVertex(graph, vertexName);
    if (operation.ok) {
      setVertexName("");
      setEdgeFrom(names[0] ?? "");
      setEdgeTo(operation.value.vertices[operation.value.vertices.length - 1].name);
      setStartVertex((currentStart) => currentStart || operation.value.vertices[0].name);
      setDestinationVertex(operation.value.vertices[operation.value.vertices.length - 1].name);
    }
    applyGraphResult(operation);
  }

  function handleAddEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weight = weightedMode ? parseWeight(edgeWeight) : 1;
    if (weight === null) {
      setStatus("Enter a valid non-negative edge weight.");
      return;
    }
    applyGraphResult(addEdge(graph, edgeFrom, edgeTo, weight));
  }

  function handleModeChange(nextDirected: boolean, nextWeighted: boolean) {
    const operation = setGraphMode(graph, nextDirected, nextWeighted);
    if (!operation.ok) {
      setStatus(operation.message);
      setDirectedMode(graph.directed);
      setWeightedMode(graph.weighted);
      return;
    }
    setDirectedMode(nextDirected);
    setWeightedMode(nextWeighted);
    applyGraphResult(operation);
  }

  function handleRemoveVertex() {
    if (selectedVertex === null) {
      setStatus("Select a vertex on the canvas before removing it.");
      return;
    }
    const operation = removeVertex(graph, selectedVertex);
    if (operation.ok) {
      setStartVertex((currentStart) =>
        currentStart === selectedVertex
          ? operation.value.vertices[0]?.name ?? ""
          : currentStart,
      );
      setDestinationVertex((currentDestination) =>
        currentDestination === selectedVertex
          ? operation.value.vertices[0]?.name ?? ""
          : currentDestination,
      );
    }
    applyGraphResult(operation);
  }

  function handleRemoveEdge() {
    const operation = removeEdge(graph, selectedEdgeIndex);
    applyGraphResult(operation);
  }

  function handleUpdateWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const weight = parseWeight(edgeWeight);
    if (weight === null) {
      setStatus("Enter a valid non-negative edge weight.");
      return;
    }
    applyGraphResult(updateEdgeWeight(graph, selectedEdgeIndex, weight));
  }

  function selectVertex(name: string) {
    setSelectedVertex(name);
    setStatus(`Selected ${name}. It can be used as an algorithm endpoint or removed.`);
  }

  function loadSample() {
    setGraph(sampleGraph);
    setDirectedMode(sampleGraph.directed);
    setWeightedMode(sampleGraph.weighted);
    setEdgeFrom("A");
    setEdgeTo("B");
    setEdgeWeight("1");
    setStartVertex("A");
    setDestinationVertex("F");
    setSelectedVertex(null);
    setSelectedEdgeIndex(0);
    invalidatePlayback("Loaded the sample weighted, undirected graph.");
  }

  function runAlgorithm() {
    const nextResult = algorithm === "bfs"
      ? breadthFirstSearch(graph, startVertex)
      : algorithm === "dfs"
        ? depthFirstSearch(graph, startVertex)
        : dijkstra(graph, startVertex, destinationVertex);
    if (nextResult.events.length === 0) {
      setResult(null);
      setStep(0);
      setIsPlaying(false);
      setStatus(nextResult.finalMessage);
      return;
    }
    if (nextResult.events.length > 1) {
      onTopicStart(`graphs-${algorithm}`);
    }
    setResult(nextResult);
    setStep(1);
    setIsPlaying(false);
    setStatus(nextResult.events[0].explanation);
    if (nextResult.events.length === 1) {
      onTopicComplete(`graphs-${algorithm}`);
    }
  }

  function play() {
    if (result === null) {
      runAlgorithm();
      return;
    }
    if (completed) {
      setStatus("Algorithm complete. Reset playback to run it again.");
      return;
    }
    setIsPlaying(true);
  }

  function stepForward() {
    if (result === null) {
      runAlgorithm();
      return;
    }
    setIsPlaying(false);
    if (step >= result.events.length) return;
    const nextStep = step + 1;
    setStep(nextStep);
    if (nextStep >= result.events.length) {
      onTopicComplete(`graphs-${result.algorithm}`);
    }
    setStatus(
      nextStep === result.events.length
        ? result.finalMessage
        : result.events[nextStep - 1].explanation,
    );
  }

  function stepBackward() {
    if (result === null) return;
    setIsPlaying(false);
    const previousStep = Math.max(0, step - 1);
    setStep(previousStep);
    setStatus(
      previousStep === 0
        ? "Playback reset to the initial graph state."
        : result.events[previousStep - 1].explanation,
    );
  }

  function resetPlayback() {
    setIsPlaying(false);
    setStep(0);
    setStatus("Playback reset. Step forward or play to start the saved run.");
  }

  const shortestPathMessage = result?.algorithm === "dijkstra" && completed
    ? result.distance === null
      ? `No path from ${startVertex} to ${destinationVertex}.`
      : `Shortest distance ${startVertex} → ${destinationVertex}: ${result.distance} · Path: ${result.path.join(" → ")}`
    : null;

  return (
    <div className="graph-page">
      <section className="graph-intro">
        <div className="eyebrow">ALGORITHMS / GRAPH EXPLORER</div>
        <p>
          Build a graph and step through breadth-first search, depth-first search,
          or Dijkstra’s shortest-path algorithm.
        </p>
      </section>

      <section className="workspace-card graph-workspace">
        <div className="section-heading">
          <div>
            <div className="eyebrow">GRAPH ALGORITHMS LAB</div>
            <h3>Build, explore, and traverse</h3>
          </div>
          <span className="complexity-badge">
            {graph.vertices.length} VERTICES · {graph.edges.length} EDGES
          </span>
        </div>

        <div className="graph-mode-controls">
          <label>
            <input
              type="checkbox"
              checked={directedMode}
              onChange={(event) =>
                handleModeChange(event.target.checked, weightedMode)
              }
            />
            Directed
          </label>
          <label>
            <input
              type="checkbox"
              checked={weightedMode}
              onChange={(event) =>
                handleModeChange(directedMode, event.target.checked)
              }
            />
            Weighted
          </label>
          <span>
            No self-loops; duplicate edges are rejected (unordered pairs in
            undirected mode).
          </span>
        </div>

        <div className="graph-editor">
          <form className="graph-editor-form" onSubmit={handleAddVertex}>
            <h4>Add vertex</h4>
            <label htmlFor="graph-vertex-name">Vertex name</label>
            <input
              id="graph-vertex-name"
              value={vertexName}
              onChange={(event) => setVertexName(event.target.value)}
              maxLength={16}
              placeholder="e.g. G"
            />
            <button className="array-action-button" type="submit">Add vertex</button>
          </form>

          <form className="graph-editor-form" onSubmit={handleAddEdge}>
            <h4>Connect vertices</h4>
            <label htmlFor="graph-edge-from">From</label>
            <select
              id="graph-edge-from"
              value={edgeFrom}
              onChange={(event) => setEdgeFrom(event.target.value)}
            >
              {names.map((name) => <option key={name}>{name}</option>)}
            </select>
            <label htmlFor="graph-edge-to">To</label>
            <select
              id="graph-edge-to"
              value={edgeTo}
              onChange={(event) => setEdgeTo(event.target.value)}
            >
              {names.map((name) => <option key={name}>{name}</option>)}
            </select>
            {weightedMode && (
              <>
                <label htmlFor="graph-edge-weight">Weight</label>
                <input
                  id="graph-edge-weight"
                  type="number"
                  min="0"
                  step="any"
                  value={edgeWeight}
                  onChange={(event) => setEdgeWeight(event.target.value)}
                  placeholder="0 or greater"
                />
              </>
            )}
            <button className="array-action-button" type="submit" disabled={names.length < 2}>
              Add edge
            </button>
          </form>

          <div className="graph-editor-form">
            <h4>Remove elements</h4>
            <p>
              {selectedVertex
                ? `Selected vertex: ${selectedVertex}`
                : "Select a vertex on the canvas to remove it."}
            </p>
            <button
              className="array-action-button"
              type="button"
              onClick={handleRemoveVertex}
              disabled={selectedVertex === null}
            >
              Remove selected vertex
            </button>
            <label htmlFor="graph-remove-edge">Edge</label>
            <select
              id="graph-remove-edge"
              value={graph.edges.length ? selectedEdgeIndex : ""}
              onChange={(event) => setSelectedEdgeIndex(Number(event.target.value))}
              disabled={graph.edges.length === 0}
            >
              {graph.edges.map((edge, index) => (
                <option key={`${edge.from}-${edge.to}-${index}`} value={index}>
                  {edge.from} {graph.directed ? "→" : "—"} {edge.to}
                  {graph.weighted ? ` · ${edge.weight}` : ""}
                </option>
              ))}
            </select>
            <button
              className="array-action-button"
              type="button"
              onClick={handleRemoveEdge}
              disabled={graph.edges.length === 0}
            >
              Remove edge
            </button>
          </div>

          {weightedMode && graph.edges.length > 0 && (
            <form className="graph-editor-form" onSubmit={handleUpdateWeight}>
              <h4>Edit edge weight</h4>
              <label htmlFor="graph-edit-edge">Edge</label>
              <select
                id="graph-edit-edge"
                value={selectedEdgeIndex}
                onChange={(event) => setSelectedEdgeIndex(Number(event.target.value))}
              >
                {graph.edges.map((edge, index) => (
                  <option key={`edit-${edge.from}-${edge.to}`} value={index}>
                    {edge.from} {graph.directed ? "→" : "—"} {edge.to}
                  </option>
                ))}
              </select>
              <label htmlFor="graph-edit-weight">New weight</label>
              <input
                id="graph-edit-weight"
                type="number"
                min="0"
                step="any"
                value={edgeWeight}
                onChange={(event) => setEdgeWeight(event.target.value)}
              />
              <button className="array-action-button" type="submit">Update weight</button>
            </form>
          )}
        </div>

        <div className="graph-canvas">
          <div className="canvas-topline">
            <span>{graph.directed ? "DIRECTED GRAPH" : "UNDIRECTED GRAPH"}</span>
            <span>{graph.weighted ? "EDGE WEIGHTS SHOWN" : "UNWEIGHTED"}</span>
          </div>
          {graph.vertices.length === 0 ? (
            <div className="graph-empty">Add a vertex to begin building the graph.</div>
          ) : (
            <div
              className="graph-canvas-scroll"
              role="region"
              aria-label="Interactive graph canvas"
              tabIndex={0}
            >
              <svg
                className="graph-svg"
                width="760"
                height="440"
                viewBox="0 0 760 440"
                role="group"
                aria-label="Graph vertices and edges"
              >
                <defs>
                  <marker
                    id="graph-arrow"
                    markerWidth="8"
                    markerHeight="8"
                    refX="7"
                    refY="4"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 0 L 8 4 L 0 8 z" fill="#a99aff" />
                  </marker>
                </defs>
                {graph.edges.map((edge, index) => {
                  const from = graph.vertices.find((vertex) => vertex.name === edge.from);
                  const to = graph.vertices.find((vertex) => vertex.name === edge.to);
                  if (!from || !to) return null;
                  const reverseExists = graph.directed && graph.edges.some(
                    (other, otherIndex) =>
                      otherIndex !== index &&
                      other.from === edge.to &&
                      other.to === edge.from,
                  );
                  const middleX = (from.x + to.x) / 2;
                  const middleY = (from.y + to.y) / 2;
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const length = Math.max(1, Math.hypot(dx, dy));
                  const curve = reverseExists ? 28 : 0;
                  const controlX = middleX - (dy / length) * curve;
                  const controlY = middleY + (dx / length) * curve;
                  const pathData = curve
                    ? `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`
                    : `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
                  const edgeIsActive = currentEdge !== null &&
                    (currentEdge.from === edge.from && currentEdge.to === edge.to ||
                      !graph.directed &&
                      currentEdge.from === edge.to &&
                      currentEdge.to === edge.from);
                  const edgeIsOnPath = pathEdgeKeys.has(edgeKey(edge));
                  const labelX = curve
                    ? (from.x + 2 * controlX + to.x) / 4
                    : middleX;
                  const labelY = curve
                    ? (from.y + 2 * controlY + to.y) / 4
                    : middleY;
                  return (
                    <g key={`edge-${edge.from}-${edge.to}`}>
                      <path
                        className={`graph-edge${edgeIsActive ? " is-active" : ""}${edgeIsOnPath ? " is-path" : ""}`}
                        d={pathData}
                        markerEnd={graph.directed ? "url(#graph-arrow)" : undefined}
                      />
                      {graph.weighted && (
                        <g className="graph-weight-label">
                          <rect x={labelX - 17} y={labelY - 11} width="34" height="22" rx="7" />
                          <text x={labelX} y={labelY + 4}>{edge.weight}</text>
                        </g>
                      )}
                    </g>
                  );
                })}
                {graph.vertices.map((vertex) => {
                  const state = current.visitedOrder.includes(vertex.name)
                    ? "is-visited"
                    : current.discovered.includes(vertex.name)
                      ? "is-discovered"
                      : "";
                  const isActive = current.activeVertex === vertex.name;
                  const isSelected =
                    selectedVertex === vertex.name ||
                    isActive ||
                    current.path.includes(vertex.name);
                  return (
                    <g
                      className={`graph-vertex ${state}${isSelected ? " is-selected" : ""}${isActive ? " is-active" : ""}`}
                      key={`vertex-${vertex.name}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`Vertex ${vertex.name}${state === "is-visited" ? ", visited" : state === "is-discovered" ? ", discovered" : ", unvisited"}${isSelected ? ", selected" : ""}`}
                      onClick={() => selectVertex(vertex.name)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectVertex(vertex.name);
                        }
                      }}
                    >
                      <circle cx={vertex.x} cy={vertex.y} r="24" />
                      <text x={vertex.x} y={vertex.y + 5}>{vertex.name}</text>
                      {algorithm === "dijkstra" && result !== null && (
                        <text className="graph-distance" x={vertex.x} y={vertex.y + 42}>
                          {current.distances[vertex.name] === null ||
                          current.distances[vertex.name] === undefined
                            ? "∞"
                            : current.distances[vertex.name]}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
          <div className="graph-legend" aria-label="Graph visualization legend">
            <span><i className="legend-unvisited" /> Unvisited</span>
            <span><i className="legend-discovered" /> Discovered</span>
            <span><i className="legend-visited" /> Visited</span>
            <span><i className="legend-active" /> Active</span>
          </div>
        </div>

        <div className="graph-algorithm-controls">
          <label htmlFor="graph-algorithm">
            Algorithm
            <select
              id="graph-algorithm"
              value={algorithm}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "bfs" || value === "dfs" || value === "dijkstra") {
                  onTopicStart(`graphs-${value}`);
                  invalidatePlayback("Algorithm changed. Choose endpoints and start a new run.");
                }
              }}
            >
              <option value="bfs">Breadth-first search (BFS)</option>
              <option value="dfs">Depth-first search (DFS)</option>
              <option value="dijkstra">Dijkstra shortest path</option>
            </select>
          </label>
          <label htmlFor="graph-start">
            {algorithm === "dijkstra" ? "Source" : "Start vertex"}
            <select
              id="graph-start"
              value={startVertex}
              onChange={(event) => {
                setStartVertex(event.target.value);
                invalidatePlayback("Start vertex changed. Run the algorithm again.");
              }}
              disabled={names.length === 0}
            >
              {names.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          {algorithm === "dijkstra" && (
            <label htmlFor="graph-destination">
              Destination
              <select
                id="graph-destination"
                value={destinationVertex}
                onChange={(event) => {
                  setDestinationVertex(event.target.value);
                  invalidatePlayback("Destination changed. Run Dijkstra again.");
                }}
                disabled={names.length === 0}
              >
                {names.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
          )}
          <button className="secondary-button" type="button" onClick={runAlgorithm} disabled={names.length === 0}>
            Run algorithm
          </button>
          <button className="secondary-button" type="button" onClick={loadSample}>
            Load sample
          </button>
        </div>

        <div className="graph-playback">
          <div className="graph-playback-controls">
            <button className="array-play-button" type="button" onClick={play} disabled={names.length === 0 || completed}>
              ▶ Play
            </button>
            <button className="array-play-button" type="button" onClick={() => setIsPlaying(false)} disabled={!isPlaying}>
              Ⅱ Pause
            </button>
            <button className="array-step-button" type="button" onClick={stepBackward} disabled={result === null || step === 0}>
              ← Step back
            </button>
            <button className="array-step-button" type="button" onClick={stepForward} disabled={names.length === 0 || completed}>
              Step forward →
            </button>
            <button className="array-step-button" type="button" onClick={resetPlayback}>
              Reset
            </button>
            <label className="graph-playback-speed" htmlFor="graph-playback-speed">
              Speed
              <select
                id="graph-playback-speed"
                value={playbackDelay}
                onChange={(event) => setPlaybackDelay(Number(event.target.value))}
              >
                <option value={1400}>0.5×</option>
                <option value={700}>1×</option>
                <option value={350}>2×</option>
              </select>
            </label>
          </div>
          <div className="graph-playback-state" aria-live="polite">
            <span className="eyebrow">STEP {result === null ? 0 : step} / {result?.events.length ?? 0}</span>
            <strong>{current.operation}</strong>
            <span>{current.explanation}</span>
          </div>
        </div>

        <div className="graph-readouts">
          <div className="graph-readout">
            <span className="eyebrow">
              {algorithm === "dijkstra" ? "SETTLED ORDER" : "VISITED ORDER"}
            </span>
            <strong>{current.visitedOrder.length ? current.visitedOrder.join(" → ") : "—"}</strong>
          </div>
          <div className="graph-readout">
            <span className="eyebrow">
              {algorithm === "bfs" ? "QUEUE" : algorithm === "dfs" ? "DFS STACK" : "FRONTIER"}
            </span>
            <strong>{current.frontier.length ? current.frontier.join(" · ") : "—"}</strong>
          </div>
          {algorithm === "dijkstra" && (
            <div className="graph-readout graph-distance-readout">
              <span className="eyebrow">DISTANCES</span>
              <div>
                {names.map((name) => (
                  <span key={name}>
                    <b>{name}</b>: {current.distances[name] ?? "∞"}
                  </span>
                ))}
              </div>
            </div>
          )}
          {shortestPathMessage && (
            <div className="graph-readout graph-shortest-path" role="status">
              <span className="eyebrow">RESULT</span>
              <strong>{shortestPathMessage}</strong>
            </div>
          )}
        </div>

        <div className="graph-status" role="status" aria-live="polite">
          <span className="array-status-dot" aria-hidden="true" />
          {status}
        </div>
      </section>

      <section className="array-learning graph-learning" aria-label="Graph algorithm concepts">
        <article className="array-learning-card">
          <div className="eyebrow">TRAVERSAL ALGORITHMS</div>
          <h3>BFS and DFS</h3>
          <p>
            <strong>BFS</strong> explores neighbors level by level using a queue.
            It finds minimum-edge-count paths in unweighted graphs. With an
            adjacency-list representation its time is O(V + E).
          </p>
          <p>
            <strong>DFS</strong> follows one branch before backtracking, using a
            stack. It is useful for reachability, component exploration, and
            cycle analysis; its time is O(V + E).
          </p>
          <p>
            Both traversals start at the selected vertex and visit only its
            reachable component. Neighbor order follows the order edges were
            added; disconnected vertices remain unvisited.
          </p>
        </article>
        <article className="array-learning-card">
          <div className="eyebrow">SHORTEST PATH</div>
          <h3>Dijkstra’s algorithm</h3>
          <p>
            Dijkstra repeatedly settles the nearest known vertex and relaxes its
            outgoing edges. It finds a minimum-total-weight path when every
            edge weight is non-negative. It is not suitable for graphs with
            negative-weight edges.
          </p>
          <p>
            This lab scans unsettled vertices to select the next minimum and
            uses adjacency lists, so its time complexity is O(V² + E). Edge
            weights must be finite and non-negative.
          </p>
          <p>
            Graphs may be directed or undirected and weighted or unweighted.
            Self-loops are disallowed; duplicate edges are disallowed, with
            undirected edges treated as unordered pairs.
          </p>
        </article>
      </section>
    </div>
  );
}

export default GraphExplorer;
