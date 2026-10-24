import assert from "node:assert/strict";
import test from "node:test";
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
  stackValues,
} from "../src/dataStructures/stacksQueues.ts";

test("stack pushes, peeks, and pops from the top without mutating prior state", () => {
  const original = createStack([10, 20]);
  const pushed = pushStack(original, 30);
  assert.equal(pushed.ok, true);
  if (!pushed.ok) return;
  assert.deepEqual(stackValues(pushed.value), [30, 20, 10]);
  assert.deepEqual(stackValues(original), [20, 10]);

  assert.deepEqual(peekStack(pushed.value), {
    ok: true,
    value: 30,
    message: "The top value is 30; the stack was not changed.",
  });
  const popped = popStack(pushed.value);
  assert.equal(popped.ok, true);
  if (!popped.ok) return;
  assert.equal(popped.value.value, 30);
  assert.deepEqual(stackValues(popped.value.stack), [20, 10]);
});

test("stack reports underflow, invalid values, and overflow", () => {
  assert.equal(popStack(createStack()).ok, false);
  assert.equal(peekStack(createStack()).ok, false);
  assert.equal(pushStack(createStack(), Number.NaN).ok, false);
  assert.equal(
    pushStack(createStack(Array.from({ length: maximumStackSize }, (_, index) => index)), 99).ok,
    false,
  );
});

test("queue enqueues, dequeues, and peeks at both endpoints", () => {
  const queue = createQueue(4, [10, 20]);
  assert.equal(peekQueueFront(queue).ok, true);
  assert.equal(peekQueueRear(queue).ok, true);
  const front = peekQueueFront(queue);
  const rear = peekQueueRear(queue);
  if (front.ok && rear.ok) {
    assert.equal(front.value, 10);
    assert.equal(rear.value, 20);
  }

  const removed = dequeue(queue);
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.value.value, 10);
  assert.equal(peekQueueFront(removed.value.queue).ok, true);
  const nextFront = peekQueueFront(removed.value.queue);
  if (nextFront.ok) assert.equal(nextFront.value, 20);
});

test("queue wraps around its circular buffer and reports overflow and underflow", () => {
  let queue = createQueue(3, [1, 2, 3]);
  const firstRemoval = dequeue(queue);
  assert.equal(firstRemoval.ok, true);
  if (!firstRemoval.ok) return;
  queue = firstRemoval.value.queue;

  const secondRemoval = dequeue(queue);
  assert.equal(secondRemoval.ok, true);
  if (!secondRemoval.ok) return;
  queue = secondRemoval.value.queue;

  const wrappedEnqueue = enqueue(queue, 4);
  assert.equal(wrappedEnqueue.ok, true);
  if (!wrappedEnqueue.ok) return;
  queue = wrappedEnqueue.value;
  const wrappedRear = peekQueueRear(queue);
  assert.equal(wrappedRear.ok, true);
  if (wrappedRear.ok) assert.equal(wrappedRear.value, 4);
  const filledQueue = enqueue(queue, 5);
  assert.equal(filledQueue.ok, true);
  if (!filledQueue.ok) return;
  assert.equal(enqueue(filledQueue.value, 6).ok, false);
  assert.equal(dequeue(createQueue(maximumQueueSize)).ok, false);
});

test("parses safe whole-number input only", () => {
  assert.equal(parseStructureInteger(" -12 "), -12);
  assert.equal(parseStructureInteger("+4"), 4);
  assert.equal(parseStructureInteger("2.5"), null);
  assert.equal(parseStructureInteger("9007199254740992"), null);
  assert.equal(parseStructureInteger(""), null);
});
