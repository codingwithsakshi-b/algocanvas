import assert from "node:assert/strict";
import test from "node:test";
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
} from "../src/dataStructures/tree.ts";

const sampleValues = [50, 30, 70, 20, 40, 60, 80];

test("creates a binary search tree and reports node properties", () => {
  const root = createBST(sampleValues);
  assert.equal(treeNodeCount(root), 7);
  assert.equal(treeHeight(root), 2);
  assert.deepEqual(getTreeNodeInfo(root, 50), {
    value: 50,
    parent: null,
    left: 30,
    right: 70,
    depth: 0,
    height: 2,
    isLeaf: false,
  });
  assert.deepEqual(getTreeNodeInfo(root, 20), {
    value: 20,
    parent: 30,
    left: null,
    right: null,
    depth: 2,
    height: 0,
    isLeaf: true,
  });
  assert.equal(getTreeNodeInfo(root, 999), null);
});

test("inserts values, reports the visited path, and rejects duplicates", () => {
  const original = createBST(sampleValues);
  const inserted = insertBST(original, 35);
  assert.equal(inserted.ok, true);
  if (!inserted.ok) return;
  assert.deepEqual(inserted.visited, [50, 30, 40, 35]);
  assert.equal(getTreeNodeInfo(inserted.value, 35)?.parent, 40);
  assert.equal(treeNodeCount(original), 7);

  const duplicate = insertBST(inserted.value, 35);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /duplicates are not allowed/);
  assert.deepEqual(duplicate.visited, [50, 30, 40, 35]);
});

test("search returns the found value or a miss with its visited path", () => {
  const root = createBST(sampleValues);
  assert.deepEqual(searchBST(root, 60), {
    ok: true,
    value: 60,
    visited: [50, 70, 60],
    message: "Found 60 in the BST.",
  });
  assert.deepEqual(searchBST(root, 65), {
    ok: true,
    value: null,
    visited: [50, 70, 60],
    message: "65 is not in the BST.",
  });
});

test("deletes a leaf, a node with one child, and a node with two children", () => {
  let root = createBST([50, 30, 70, 20, 40, 60, 80, 65]);

  const leaf = deleteBST(root, 20);
  assert.equal(leaf.ok, true);
  if (!leaf.ok) return;
  root = leaf.value;
  assert.equal(getTreeNodeInfo(root, 20), null);

  const oneChild = deleteBST(root, 60);
  assert.equal(oneChild.ok, true);
  if (!oneChild.ok) return;
  root = oneChild.value;
  assert.equal(getTreeNodeInfo(root, 65)?.parent, 70);

  const twoChildren = deleteBST(root, 70);
  assert.equal(twoChildren.ok, true);
  if (!twoChildren.ok) return;
  assert.deepEqual(twoChildren.visited, [50, 70, 80]);
  root = twoChildren.value;
  assert.equal(getTreeNodeInfo(root, 70), null);
  assert.equal(getTreeNodeInfo(root, 80)?.parent, 50);
  assert.equal(treeNodeCount(root), 5);
});

test("deletes the root in all child-count cases and handles a missing value", () => {
  const leafRoot = deleteBST(createBST([5]), 5);
  assert.equal(leafRoot.ok, true);
  if (leafRoot.ok) assert.equal(leafRoot.value, null);

  const oneChildRoot = deleteBST(createBST([5, 3]), 5);
  assert.equal(oneChildRoot.ok, true);
  if (oneChildRoot.ok) assert.equal(oneChildRoot.value?.value, 3);

  const twoChildrenRoot = deleteBST(createBST([5, 3, 7, 6, 8]), 5);
  assert.equal(twoChildrenRoot.ok, true);
  if (twoChildrenRoot.ok) {
    assert.equal(twoChildrenRoot.value?.value, 6);
    assert.deepEqual(traverseTree(twoChildrenRoot.value, "inorder"), [3, 6, 7, 8]);
  }

  const missing = deleteBST(createBST([5, 3, 7]), 10);
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.visited, [5, 7]);
});

test("returns each traversal in its defined order", () => {
  const root = createBST(sampleValues);
  assert.deepEqual(traverseTree(root, "preorder"), [50, 30, 20, 40, 70, 60, 80]);
  assert.deepEqual(traverseTree(root, "inorder"), [20, 30, 40, 50, 60, 70, 80]);
  assert.deepEqual(traverseTree(root, "postorder"), [20, 40, 30, 60, 80, 70, 50]);
  assert.deepEqual(traverseTree(root, "level-order"), [50, 30, 70, 20, 40, 60, 80]);
  assert.deepEqual(traverseTree(null, "preorder"), []);
});

test("parses only safe whole-number input", () => {
  assert.equal(parseTreeInteger(" -12 "), -12);
  assert.equal(parseTreeInteger("+4"), 4);
  assert.equal(parseTreeInteger("2.5"), null);
  assert.equal(parseTreeInteger("9007199254740992"), null);
  assert.equal(parseTreeInteger(""), null);
});
