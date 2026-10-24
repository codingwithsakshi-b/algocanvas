import assert from "node:assert/strict";
import test from "node:test";
import {
  append,
  createLinkedList,
  deleteAt,
  deleteFirst,
  deleteLast,
  findValue,
  insertAt,
  linkedListNodes,
  maximumListLength,
  parseListInteger,
  prepend,
  updateAt,
} from "../src/dataStructures/linkedList.ts";

function valuesOf(head: ReturnType<typeof createLinkedList>): number[] {
  return linkedListNodes(head).map((node) => node.value);
}

test("creates an ordered linked list and preserves node indexes", () => {
  const head = createLinkedList([10, 20, 30]);
  assert.deepEqual(valuesOf(head), [10, 20, 30]);
  assert.deepEqual(linkedListNodes(head).map((node) => node.id), [1, 2, 3]);
  assert.equal(linkedListNodes(head)[2].next, null);
});

test("inserts at the beginning, end, and a valid index immutably", () => {
  const original = createLinkedList([10, 30]);
  const first = prepend(original, 5, 3);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(valuesOf(first.value), [5, 10, 30]);

  const last = append(first.value, 40, 4);
  assert.equal(last.ok, true);
  if (!last.ok) return;
  const middle = insertAt(last.value, 20, 2, 5);
  assert.equal(middle.ok, true);
  if (!middle.ok) return;

  assert.deepEqual(valuesOf(middle.value), [5, 10, 20, 30, 40]);
  assert.deepEqual(valuesOf(original), [10, 30]);
});

test("rejects invalid insertion indexes, values, and over-capacity lists", () => {
  const head = createLinkedList([1, 2]);
  assert.equal(insertAt(head, 3, -1, 3).ok, false);
  assert.equal(insertAt(head, 3, 3, 3).ok, false);
  assert.equal(insertAt(head, Number.NaN, 1, 3).ok, false);
  assert.equal(
    append(createLinkedList(Array.from({ length: maximumListLength }, (_, i) => i)), 13, 20).ok,
    false,
  );
});

test("deletes the first, last, and indexed nodes, including the only node", () => {
  const head = createLinkedList([10, 20, 30]);
  const first = deleteFirst(head);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.deepEqual(valuesOf(first.value), [20, 30]);

  const last = deleteLast(first.value);
  assert.equal(last.ok, true);
  if (!last.ok) return;
  assert.deepEqual(valuesOf(last.value), [20]);

  const only = deleteAt(last.value, 0);
  assert.equal(only.ok, true);
  if (!only.ok) return;
  assert.equal(only.value, null);
  assert.equal(deleteFirst(null).ok, false);
  assert.equal(deleteAt(head, 3).ok, false);
});

test("updates a node without changing its identity or neighboring links", () => {
  const head = createLinkedList([10, 20, 30]);
  const updated = updateAt(head, 25, 1);
  assert.equal(updated.ok, true);
  if (!updated.ok) return;

  assert.deepEqual(valuesOf(updated.value), [10, 25, 30]);
  assert.deepEqual(
    linkedListNodes(updated.value).map((node) => node.id),
    linkedListNodes(head).map((node) => node.id),
  );
  assert.deepEqual(valuesOf(head), [10, 20, 30]);
  assert.equal(updateAt(null, 2, 0).ok, false);
  assert.equal(updateAt(head, 2, -1).ok, false);
});

test("search returns the first matching index, including for duplicates", () => {
  const head = createLinkedList([4, 8, 8, 12]);
  assert.equal(findValue(head, 8), 1);
  assert.equal(findValue(head, 99), null);
  assert.equal(findValue(null, 8), null);
});

test("parses only safe whole-number input", () => {
  assert.equal(parseListInteger("  -12 "), -12);
  assert.equal(parseListInteger("+4"), 4);
  assert.equal(parseListInteger(""), null);
  assert.equal(parseListInteger("2.5"), null);
  assert.equal(parseListInteger("9007199254740992"), null);
});
