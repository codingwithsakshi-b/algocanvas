export type GraphVertex = Readonly<{
  name: string;
  x: number;
  y: number;
}>;

export type GraphEdge = Readonly<{
  from: string;
  to: string;
  weight: number;
}>;

export type GraphDefinition = Readonly<{
  vertices: readonly GraphVertex[];
  edges: readonly GraphEdge[];
  directed: boolean;
  weighted: boolean;
}>;

export type GraphOperationResult<T> =
  | { ok: true; value: T; message: string }
  | { ok: false; message: string };

export type GraphEdgeRef = Readonly<{ from: string; to: string }>;

export type GraphAlgorithm = "bfs" | "dfs" | "dijkstra";

export type GraphStep = Readonly<{
  operation: string;
  explanation: string;
  visitedOrder: readonly string[];
  discovered: readonly string[];
  frontier: readonly string[];
  distances: Readonly<Record<string, number | null>>;
  activeVertex: string | null;
  activeEdge: GraphEdgeRef | null;
  path: readonly string[];
}>;

export type GraphAlgorithmResult = Readonly<{
  algorithm: GraphAlgorithm;
  events: readonly GraphStep[];
  finalMessage: string;
  destination: string | null;
  distance: number | null;
  path: readonly string[];
}>;

const canvasWidth = 760;
const canvasHeight = 440;

function success<T>(value: T, message: string): GraphOperationResult<T> {
  return { ok: true, value, message };
}

function failure<T>(message: string): GraphOperationResult<T> {
  return { ok: false, message };
}

function placeVertex(index: number, count: number): Pick<GraphVertex, "x" | "y"> {
  const angle = (2 * Math.PI * index) / Math.max(count, 3) - Math.PI / 2;
  const radiusX = Math.min(290, 100 + count * 20);
  const radiusY = Math.min(155, 55 + count * 12);
  return {
    x: canvasWidth / 2 + Math.cos(angle) * radiusX,
    y: canvasHeight / 2 + Math.sin(angle) * radiusY,
  };
}

export function createGraph(
  names: readonly string[],
  edges: readonly GraphEdge[] = [],
  directed = false,
  weighted = false,
): GraphDefinition {
  const vertices = names.map((name, index) => ({
    name,
    ...placeVertex(index, names.length),
  }));
  return { vertices, edges, directed, weighted };
}

export function addVertex(
  graph: GraphDefinition,
  rawName: string,
): GraphOperationResult<GraphDefinition> {
  const name = rawName.trim();
  if (!name) return failure("Enter a name for the vertex.");
  if (graph.vertices.some((vertex) => vertex.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return failure(`A vertex named "${name}" already exists.`);
  }

  const vertex = {
    name,
    ...placeVertex(graph.vertices.length, graph.vertices.length + 1),
  };
  return success(
    { ...graph, vertices: [...graph.vertices, vertex] },
    `Added vertex "${name}".`,
  );
}

function existingVertex(graph: GraphDefinition, name: string): boolean {
  return graph.vertices.some((vertex) => vertex.name === name);
}

export function addEdge(
  graph: GraphDefinition,
  from: string,
  to: string,
  weight: number,
): GraphOperationResult<GraphDefinition> {
  if (!existingVertex(graph, from) || !existingVertex(graph, to)) {
    return failure("Both edge endpoints must be existing vertices.");
  }
  if (from === to) return failure("Self-loops are not supported.");
  if (!Number.isFinite(weight) || weight < 0) {
    return failure("Edge weights must be non-negative finite numbers.");
  }
  const duplicate = graph.edges.some((edge) =>
    edge.from === from && edge.to === to ||
    !graph.directed && edge.from === to && edge.to === from
  );
  if (duplicate) return failure("That edge already exists.");

  return success(
    { ...graph, edges: [...graph.edges, { from, to, weight }] },
    graph.weighted
      ? `Connected ${from} to ${to} with weight ${weight}.`
      : `Connected ${from} to ${to}.`,
  );
}

export function removeEdge(
  graph: GraphDefinition,
  edgeIndex: number,
): GraphOperationResult<GraphDefinition> {
  const edge = graph.edges[edgeIndex];
  if (!edge) return failure("Choose an existing edge to remove.");
  const edges = graph.edges.filter((_, index) => index !== edgeIndex);
  return success(
    { ...graph, edges },
    `Removed edge ${edge.from} ${graph.directed ? "→" : "—"} ${edge.to}.`,
  );
}

export function removeVertex(
  graph: GraphDefinition,
  name: string,
): GraphOperationResult<GraphDefinition> {
  if (!existingVertex(graph, name)) return failure(`Vertex "${name}" does not exist.`);
  const edges = graph.edges.filter((edge) => edge.from !== name && edge.to !== name);
  return success(
    {
      ...graph,
      vertices: graph.vertices.filter((vertex) => vertex.name !== name),
      edges,
    },
    `Removed vertex "${name}" and ${graph.edges.length - edges.length} connected edge(s).`,
  );
}

export function setGraphMode(
  graph: GraphDefinition,
  directed: boolean,
  weighted: boolean,
): GraphOperationResult<GraphDefinition> {
  if (!directed) {
    const unique = new Set<string>();
    for (const edge of graph.edges) {
      const key = [edge.from, edge.to].sort().join("\u0000");
      if (unique.has(key)) {
        return failure("Remove reverse-direction duplicate edges before switching to undirected mode.");
      }
      unique.add(key);
    }
  }
  return success(
    { ...graph, directed, weighted },
    `Graph mode set to ${directed ? "directed" : "undirected"} and ${weighted ? "weighted" : "unweighted"}.`,
  );
}

export function updateEdgeWeight(
  graph: GraphDefinition,
  edgeIndex: number,
  weight: number,
): GraphOperationResult<GraphDefinition> {
  if (!Number.isFinite(weight) || weight < 0) {
    return failure("Edge weights must be non-negative finite numbers.");
  }
  if (!graph.edges[edgeIndex]) return failure("Choose an existing edge to edit.");
  return success(
    {
      ...graph,
      edges: graph.edges.map((edge, index) =>
        index === edgeIndex ? { ...edge, weight } : edge,
      ),
    },
    `Updated edge weight to ${weight}.`,
  );
}

type AdjacencyEntry = {
  vertex: string;
  weight: number;
  edge: GraphEdgeRef;
};

function buildAdjacency(graph: GraphDefinition): Map<string, AdjacencyEntry[]> {
  const adjacency = new Map<string, AdjacencyEntry[]>(
    graph.vertices.map((vertex) => [vertex.name, []]),
  );
  for (const edge of graph.edges) {
    adjacency.get(edge.from)?.push({
      vertex: edge.to,
      weight: edge.weight,
      edge: { from: edge.from, to: edge.to },
    });
    if (!graph.directed) {
      adjacency.get(edge.to)?.push({
        vertex: edge.from,
        weight: edge.weight,
        edge: { from: edge.from, to: edge.to },
      });
    }
  }
  return adjacency;
}

function emptyDistances(graph: GraphDefinition): Record<string, number | null> {
  return Object.fromEntries(graph.vertices.map((vertex) => [vertex.name, null]));
}

function makeStep(
  operation: string,
  explanation: string,
  state: {
    visitedOrder: readonly string[];
    discovered: readonly string[];
    frontier: readonly string[];
    distances?: Readonly<Record<string, number | null>>;
    activeVertex?: string | null;
    activeEdge?: GraphEdgeRef | null;
    path?: readonly string[];
  },
): GraphStep {
  return {
    operation,
    explanation,
    visitedOrder: [...state.visitedOrder],
    discovered: [...state.discovered],
    frontier: [...state.frontier],
    distances: { ...(state.distances ?? {}) },
    activeVertex: state.activeVertex ?? null,
    activeEdge: state.activeEdge ?? null,
    path: state.path ?? [],
  };
}

export function breadthFirstSearch(
  graph: GraphDefinition,
  start: string,
): GraphAlgorithmResult {
  if (!existingVertex(graph, start)) {
    return {
      algorithm: "bfs",
      events: [],
      finalMessage: `Start vertex "${start}" does not exist.`,
      destination: null,
      distance: null,
      path: [],
    };
  }
  const adjacency = buildAdjacency(graph);
  const events: GraphStep[] = [];
  const discovered = new Set([start]);
  const visited = new Set<string>();
  const queue = [start];
  events.push(makeStep(
    "Enqueue start",
    `Add ${start} to the queue.`,
    { visitedOrder: [], discovered: [start], frontier: queue },
  ));
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    events.push(makeStep(
      "Visit vertex",
      `Remove ${current} from the front of the queue and visit it.`,
      {
        visitedOrder: [...visited, current],
        discovered: [...discovered],
        frontier: queue,
        activeVertex: current,
      },
    ));
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      events.push(makeStep(
        "Explore edge",
        `Explore ${neighbor.edge.from} ${graph.directed ? "→" : "—"} ${neighbor.edge.to}.`,
        {
          visitedOrder: [...visited],
          discovered: [...discovered],
          frontier: queue,
          activeVertex: current,
          activeEdge: neighbor.edge,
        },
      ));
      if (!discovered.has(neighbor.vertex)) {
        discovered.add(neighbor.vertex);
        queue.push(neighbor.vertex);
        events.push(makeStep(
          "Discover vertex",
          `Discover ${neighbor.vertex} and enqueue it.`,
          {
            visitedOrder: [...visited],
            discovered: [...discovered],
            frontier: queue,
            activeVertex: current,
            activeEdge: neighbor.edge,
          },
        ));
      }
    }
  }
  const unreached = graph.vertices
    .map((vertex) => vertex.name)
    .filter((name) => !visited.has(name));
  const finalMessage = unreached.length
    ? `BFS visited ${visited.size} reachable vertices from ${start}; disconnected vertices not visited: ${unreached.join(", ")}.`
    : `BFS visited all ${visited.size} vertices from ${start}.`;
  events.push(makeStep(
    "Traversal complete",
    finalMessage,
    { visitedOrder: [...visited], discovered: [...discovered], frontier: [] },
  ));
  return {
    algorithm: "bfs",
    events,
    finalMessage,
    destination: null,
    distance: null,
    path: [],
  };
}

export function depthFirstSearch(
  graph: GraphDefinition,
  start: string,
): GraphAlgorithmResult {
  if (!existingVertex(graph, start)) {
    return {
      algorithm: "dfs",
      events: [],
      finalMessage: `Start vertex "${start}" does not exist.`,
      destination: null,
      distance: null,
      path: [],
    };
  }
  const adjacency = buildAdjacency(graph);
  const events: GraphStep[] = [];
  const discovered = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [start];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || visited.has(current)) continue;
    discovered.add(current);
    visited.add(current);
    events.push(makeStep(
      "Visit vertex",
      `Pop ${current} from the DFS stack and visit it.`,
      {
        visitedOrder: [...visited],
        discovered: [...discovered],
        frontier: [...stack],
        activeVertex: current,
      },
    ));
    const neighbors = adjacency.get(current) ?? [];
    for (let index = neighbors.length - 1; index >= 0; index -= 1) {
      const neighbor = neighbors[index];
      events.push(makeStep(
        "Explore edge",
        `Explore ${neighbor.edge.from} ${graph.directed ? "→" : "—"} ${neighbor.edge.to}.`,
        {
          visitedOrder: [...visited],
          discovered: [...discovered],
          frontier: [...stack],
          activeVertex: current,
          activeEdge: neighbor.edge,
        },
      ));
      if (!discovered.has(neighbor.vertex)) {
        discovered.add(neighbor.vertex);
        stack.push(neighbor.vertex);
        events.push(makeStep(
          "Push vertex",
          `Push ${neighbor.vertex} onto the DFS stack.`,
          {
            visitedOrder: [...visited],
            discovered: [...discovered],
            frontier: [...stack],
            activeVertex: current,
            activeEdge: neighbor.edge,
          },
        ));
      }
    }
  }
  const unreached = graph.vertices
    .map((vertex) => vertex.name)
    .filter((name) => !visited.has(name));
  const finalMessage = unreached.length
    ? `DFS visited ${visited.size} reachable vertices from ${start}; disconnected vertices not visited: ${unreached.join(", ")}.`
    : `DFS visited all ${visited.size} vertices from ${start}.`;
  events.push(makeStep(
    "Traversal complete",
    finalMessage,
    { visitedOrder: [...visited], discovered: [...discovered], frontier: [] },
  ));
  return {
    algorithm: "dfs",
    events,
    finalMessage,
    destination: null,
    distance: null,
    path: [],
  };
}

export function dijkstra(
  graph: GraphDefinition,
  start: string,
  destination: string,
): GraphAlgorithmResult {
  const emptyResult = (
    finalMessage: string,
  ): GraphAlgorithmResult => ({
    algorithm: "dijkstra",
    events: [],
    finalMessage,
    destination,
    distance: null,
    path: [],
  });
  if (!graph.weighted) return emptyResult("Enable weighted mode before running Dijkstra.");
  if (graph.edges.some((edge) => edge.weight < 0)) {
    return emptyResult("Dijkstra cannot run on graphs with negative edge weights.");
  }
  if (!existingVertex(graph, start) || !existingVertex(graph, destination)) {
    return emptyResult("Choose existing source and destination vertices.");
  }

  const adjacency = buildAdjacency(graph);
  const distances = emptyDistances(graph);
  const previous = new Map<string, string>();
  const settled = new Set<string>();
  distances[start] = 0;
  const events: GraphStep[] = [];
  events.push(makeStep(
    "Initialize distances",
    `Set the source ${start} distance to 0; all other distances are unknown.`,
    {
      visitedOrder: [],
      discovered: [start],
      frontier: [start],
      distances,
      activeVertex: start,
    },
  ));

  while (true) {
    let current: string | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const vertex of graph.vertices) {
      const distance = distances[vertex.name];
      if (!settled.has(vertex.name) && distance !== null && distance < bestDistance) {
        current = vertex.name;
        bestDistance = distance;
      }
    }
    if (current === null) break;

    settled.add(current);
    events.push(makeStep(
      "Select minimum",
      `Select unsettled vertex ${current} with distance ${bestDistance}.`,
      {
        visitedOrder: [...settled],
        discovered: graph.vertices
          .filter((vertex) => distances[vertex.name] !== null)
          .map((vertex) => vertex.name),
        frontier: graph.vertices
          .filter((vertex) => !settled.has(vertex.name) && distances[vertex.name] !== null)
          .map((vertex) => vertex.name),
        distances,
        activeVertex: current,
      },
    ));
    if (current === destination) {
      events.push(makeStep(
        "Destination settled",
        `Destination ${destination} is settled with distance ${bestDistance}.`,
        {
          visitedOrder: [...settled],
          discovered: graph.vertices
            .filter((vertex) => distances[vertex.name] !== null)
            .map((vertex) => vertex.name),
          frontier: graph.vertices
            .filter((vertex) => !settled.has(vertex.name) && distances[vertex.name] !== null)
            .map((vertex) => vertex.name),
          distances,
          activeVertex: current,
        },
      ));
      break;
    }

    for (const neighbor of adjacency.get(current) ?? []) {
      const candidate = bestDistance + neighbor.weight;
      const currentDistance = distances[neighbor.vertex];
      if (currentDistance === null || candidate < currentDistance) {
        distances[neighbor.vertex] = candidate;
        previous.set(neighbor.vertex, current);
        events.push(makeStep(
          "Relax edge",
          `Relax ${neighbor.edge.from} ${graph.directed ? "→" : "—"} ${neighbor.edge.to}: update distance to ${neighbor.vertex} to ${candidate}.`,
          {
            visitedOrder: [...settled],
            discovered: graph.vertices
              .filter((vertex) => distances[vertex.name] !== null)
              .map((vertex) => vertex.name),
            frontier: graph.vertices
              .filter((vertex) => !settled.has(vertex.name) && distances[vertex.name] !== null)
              .map((vertex) => vertex.name),
            distances,
            activeVertex: current,
            activeEdge: neighbor.edge,
          },
        ));
      } else {
        events.push(makeStep(
          "Keep distance",
          `Keep distance ${currentDistance} for ${neighbor.vertex}; the route through ${current} costs ${candidate}.`,
          {
            visitedOrder: [...settled],
            discovered: graph.vertices
              .filter((vertex) => distances[vertex.name] !== null)
              .map((vertex) => vertex.name),
            frontier: graph.vertices
              .filter((vertex) => !settled.has(vertex.name) && distances[vertex.name] !== null)
              .map((vertex) => vertex.name),
            distances,
            activeVertex: current,
            activeEdge: neighbor.edge,
          },
        ));
      }
    }
  }

  const finalDistance = distances[destination];
  const path: string[] = [];
  if (finalDistance !== null) {
    let current: string | undefined = destination;
    while (current !== undefined) {
      path.unshift(current);
      current = previous.get(current);
    }
  }
  const finalMessage = finalDistance === null
    ? `Destination ${destination} is unreachable from ${start}.`
    : `Shortest path ${path.join(" → ")} has total weight ${finalDistance}.`;
  events.push(makeStep(
    "Shortest path complete",
    finalMessage,
    {
      visitedOrder: [...settled],
      discovered: graph.vertices
        .filter((vertex) => distances[vertex.name] !== null)
        .map((vertex) => vertex.name),
      frontier: [],
      distances,
      activeVertex: destination,
      path,
    },
  ));
  return {
    algorithm: "dijkstra",
    events,
    finalMessage,
    destination,
    distance: finalDistance,
    path,
  };
}

export function replayGraphEvents(
  events: readonly GraphStep[],
  step: number,
): GraphStep {
  const boundedStep = Math.max(0, Math.min(step, events.length));
  if (boundedStep === 0) {
    return makeStep(
      "Ready",
      "Start an algorithm to see its steps.",
      { visitedOrder: [], discovered: [], frontier: [] },
    );
  }
  return events[boundedStep - 1];
}
