import assert from "node:assert/strict";
import test from "node:test";
import {
  addEdge,
  addVertex,
  breadthFirstSearch,
  createGraph,
  depthFirstSearch,
  dijkstra,
  removeVertex,
  replayGraphEvents,
  setGraphMode,
  updateEdgeWeight,
} from "../src/algorithms/graph.ts";

test("graph editing validates names, endpoints, duplicates, loops, weights, and deletion", () => {
  let graph = createGraph(["A", "B", "C"], [], false, true);
  assert.equal(addVertex(graph, " A ").ok, false);
  const added = addVertex(graph, "D");
  assert.equal(added.ok, true);
  if (added.ok) graph = added.value;
  assert.equal(addEdge(graph, "A", "Missing", 1).ok, false);
  assert.equal(addEdge(graph, "A", "A", 1).ok, false);
  assert.equal(addEdge(graph, "A", "B", -1).ok, false);
  const edge = addEdge(graph, "A", "B", 2);
  assert.equal(edge.ok, true);
  if (edge.ok) graph = edge.value;
  assert.equal(addEdge(graph, "B", "A", 3).ok, false);

  const removal = removeVertex(graph, "A");
  assert.equal(removal.ok, true);
  if (removal.ok) {
    assert.equal(removal.value.vertices.some((vertex) => vertex.name === "A"), false);
    assert.equal(removal.value.edges.length, 0);
  }
});

test("directed and weighted mode changes preserve edge integrity", () => {
  let graph = createGraph(["A", "B"], [], true, false);
  const forward = addEdge(graph, "A", "B", 1);
  assert.equal(forward.ok, true);
  if (!forward.ok) return;
  graph = forward.value;
  const reverse = addEdge(graph, "B", "A", 2);
  assert.equal(reverse.ok, true);
  if (!reverse.ok) return;
  graph = reverse.value;
  assert.equal(setGraphMode(graph, false, true).ok, false);
  const weighted = setGraphMode(graph, true, true);
  assert.equal(weighted.ok, true);
  if (!weighted.ok) return;
  const edited = updateEdgeWeight(weighted.value, 0, 5);
  assert.equal(edited.ok, true);
  if (edited.ok) assert.equal(edited.value.edges[0].weight, 5);
  assert.equal(updateEdgeWeight(graph, 0, Number.POSITIVE_INFINITY).ok, false);
});

const sampleGraph = createGraph(
  ["A", "B", "C", "D", "E", "Z"],
  [
    { from: "A", to: "B", weight: 1 },
    { from: "A", to: "C", weight: 1 },
    { from: "B", to: "D", weight: 1 },
    { from: "C", to: "E", weight: 1 },
  ],
);

test("BFS follows edge insertion order and reports reachable and disconnected nodes", () => {
  const result = breadthFirstSearch(sampleGraph, "A");
  const final = result.events[result.events.length - 1];
  assert.deepEqual(final.visitedOrder, ["A", "B", "C", "D", "E"]);
  assert.match(result.finalMessage, /disconnected vertices not visited: Z/);
  assert.ok(result.events.some((event) => event.operation === "Explore edge"));
  assert.deepEqual(replayGraphEvents(result.events, 0).visitedOrder, []);
  assert.deepEqual(
    replayGraphEvents(result.events, 1),
    result.events[0],
  );
});

test("DFS uses deterministic depth-first order and starts only from the selected component", () => {
  const result = depthFirstSearch(sampleGraph, "A");
  const final = result.events[result.events.length - 1];
  assert.deepEqual(final.visitedOrder, ["A", "B", "D", "C", "E"]);
  assert.match(result.finalMessage, /disconnected vertices not visited: Z/);
  assert.ok(result.events.some((event) => event.frontier.length > 0));
});

test("Dijkstra finds weighted shortest paths and reports unreachable destinations", () => {
  const graph = createGraph(
    ["A", "B", "C", "D", "Z"],
    [
      { from: "A", to: "B", weight: 4 },
      { from: "A", to: "C", weight: 1 },
      { from: "C", to: "B", weight: 2 },
      { from: "B", to: "D", weight: 1 },
      { from: "C", to: "D", weight: 7 },
    ],
    false,
    true,
  );
  const result = dijkstra(graph, "A", "D");
  assert.equal(result.distance, 4);
  assert.deepEqual(result.path, ["A", "C", "B", "D"]);
  assert.deepEqual(result.events[result.events.length - 1].path, result.path);
  assert.equal(result.events[1].distances.A, 0);
  const unreachable = dijkstra(graph, "A", "Z");
  assert.equal(unreachable.distance, null);
  assert.match(unreachable.finalMessage, /unreachable/);
  assert.equal(dijkstra(createGraph(["A", "B"]), "A", "B").events.length, 0);
});

test("Dijkstra respects edge direction and refuses negative weights", () => {
  const directed = createGraph(
    ["A", "B"],
    [{ from: "B", to: "A", weight: 1 }],
    true,
    true,
  );
  assert.equal(dijkstra(directed, "A", "B").distance, null);
  const negative = createGraph(
    ["A", "B"],
    [{ from: "A", to: "B", weight: -2 }],
    true,
    true,
  );
  assert.match(dijkstra(negative, "A", "B").finalMessage, /negative/);
});
