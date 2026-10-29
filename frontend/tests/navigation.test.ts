import assert from "node:assert/strict";
import test from "node:test";
import {
  hashForRoute,
  resolveAppRoute,
  resolveStartupRoute,
} from "../src/navigation.ts";

test("the root and public home resolve to the landing page", () => {
  assert.deepEqual(resolveAppRoute(""), { page: "landing" });
  assert.deepEqual(resolveAppRoute("#home"), { page: "landing" });
});

test("Learn and workspace topic routes survive refreshable URL parsing", () => {
  assert.deepEqual(resolveAppRoute("#learn"), { page: "learn" });
  assert.deepEqual(resolveAppRoute("#playground"), { page: "playground" });
  assert.deepEqual(resolveAppRoute("#workspace/sorting-bubble-sort"), {
    page: "workspace",
    topicId: "sorting-bubble-sort",
  });
  assert.deepEqual(resolveAppRoute("#workspace/data-structures-trees"), {
    page: "workspace",
    topicId: "data-structures-trees",
  });
  assert.deepEqual(resolveAppRoute("#workspace/graphs-dijkstra"), {
    page: "workspace",
    topicId: "graphs-dijkstra",
  });
});

test("startup routes send signed-in root visits to Learn and preserve nested routes", () => {
  assert.deepEqual(resolveStartupRoute("", false), { page: "landing" });
  assert.deepEqual(resolveStartupRoute("", true), { page: "learn" });
  assert.deepEqual(resolveStartupRoute("#workspace/graphs-dijkstra", true), {
    page: "workspace",
    topicId: "graphs-dijkstra",
  });
  assert.deepEqual(resolveStartupRoute("#learn", true), { page: "learn" });
  assert.deepEqual(resolveStartupRoute("#playground", true), {
    page: "playground",
  });
});

test("legacy section fragments continue to open their workspace", () => {
  assert.equal(resolveAppRoute("#sorting").page, "workspace");
  assert.equal(resolveAppRoute("#structures").topicId, "data-structures-arrays");
  assert.equal(resolveAppRoute("#graphs").topicId, "graphs-bfs");
});

test("workspace route hashes identify their topic", () => {
  assert.equal(
    hashForRoute({ page: "workspace", topicId: "sorting-bubble-sort" }),
    "#workspace/sorting-bubble-sort",
  );
  assert.equal(hashForRoute({ page: "learn" }), "#learn");
  assert.equal(hashForRoute({ page: "playground" }), "#playground");
});
