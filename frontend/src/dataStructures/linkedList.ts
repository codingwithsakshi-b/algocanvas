export type LinkedListNode = Readonly<{
  id: number;
  value: number;
  next: LinkedListNode | null;
}>;

export type ListResult<T> =
  | { ok: true; value: T; message: string }
  | { ok: false; message: string };

export const maximumListLength = 12;

function success<T>(value: T, message: string): ListResult<T> {
  return { ok: true, value, message };
}

function failure<T>(message: string): ListResult<T> {
  return { ok: false, message };
}

export function linkedListNodes(head: LinkedListNode | null): LinkedListNode[] {
  const nodes: LinkedListNode[] = [];
  let current = head;

  while (current !== null) {
    nodes.push(current);
    current = current.next;
  }

  return nodes;
}

export function createLinkedList(
  values: readonly number[],
  firstId = 1,
): LinkedListNode | null {
  let head: LinkedListNode | null = null;

  for (let index = values.length - 1; index >= 0; index -= 1) {
    head = {
      id: firstId + index,
      value: values[index],
      next: head,
    };
  }

  return head;
}

function validValue(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function insertAt(
  head: LinkedListNode | null,
  value: number,
  index: number,
  newId: number,
): ListResult<LinkedListNode | null> {
  const nodes = linkedListNodes(head);
  if (!validValue(value)) return failure("Enter a valid whole-number value.");
  if (!Number.isInteger(index) || index < 0 || index > nodes.length) {
    return failure(`Choose an insertion index from 0 to ${nodes.length}.`);
  }
  if (nodes.length >= maximumListLength) {
    return failure(`The list is at its maximum length of ${maximumListLength}.`);
  }

  let next = nodes[index] ?? null;
  next = { id: newId, value, next };
  for (let position = index - 1; position >= 0; position -= 1) {
    next = { ...nodes[position], next };
  }

  return success(next, `Inserted ${value} at index ${index}.`);
}

export function prepend(
  head: LinkedListNode | null,
  value: number,
  newId: number,
): ListResult<LinkedListNode | null> {
  return insertAt(head, value, 0, newId);
}

export function append(
  head: LinkedListNode | null,
  value: number,
  newId: number,
): ListResult<LinkedListNode | null> {
  return insertAt(head, value, linkedListNodes(head).length, newId);
}

export function deleteAt(
  head: LinkedListNode | null,
  index: number,
): ListResult<LinkedListNode | null> {
  const nodes = linkedListNodes(head);
  if (nodes.length === 0) return failure("The list is empty; there is no node to delete.");
  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) {
    return failure(`Choose a node index from 0 to ${nodes.length - 1}.`);
  }

  let next = nodes[index].next;
  for (let position = index - 1; position >= 0; position -= 1) {
    next = { ...nodes[position], next };
  }

  return success(next, `Deleted ${nodes[index].value} at index ${index}.`);
}

export function deleteFirst(
  head: LinkedListNode | null,
): ListResult<LinkedListNode | null> {
  return deleteAt(head, 0);
}

export function deleteLast(
  head: LinkedListNode | null,
): ListResult<LinkedListNode | null> {
  const nodes = linkedListNodes(head);
  return deleteAt(head, nodes.length - 1);
}

export function updateAt(
  head: LinkedListNode | null,
  value: number,
  index: number,
): ListResult<LinkedListNode | null> {
  const nodes = linkedListNodes(head);
  if (!validValue(value)) return failure("Enter a valid whole-number value.");
  if (nodes.length === 0) return failure("The list is empty; there is no node to update.");
  if (!Number.isInteger(index) || index < 0 || index >= nodes.length) {
    return failure(`Choose a node index from 0 to ${nodes.length - 1}.`);
  }

  let next: LinkedListNode | null = {
    ...nodes[index],
    value,
  };
  for (let position = index - 1; position >= 0; position -= 1) {
    next = { ...nodes[position], next };
  }

  return success(next, `Updated index ${index} to ${value}.`);
}

export function findValue(
  head: LinkedListNode | null,
  value: number,
): number | null {
  let current = head;
  let index = 0;

  while (current !== null) {
    if (current.value === value) return index;
    current = current.next;
    index += 1;
  }

  return null;
}

export function parseListInteger(input: string): number | null {
  const trimmed = input.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}
