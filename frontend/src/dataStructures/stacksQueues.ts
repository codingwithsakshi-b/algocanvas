export type OperationResult<T> =
  | { ok: true; value: T; message: string }
  | { ok: false; message: string };

export type StackNode = Readonly<{
  value: number;
  next: StackNode | null;
}>;

export type StackState = Readonly<{
  top: StackNode | null;
  size: number;
}>;

export type StackChange = {
  stack: StackState;
  value: number;
};

export type QueueState = {
  slots: readonly (number | null)[];
  frontIndex: number;
  size: number;
};

export type QueueChange = {
  queue: QueueState;
  value: number;
};

export const maximumStackSize = 8;
export const maximumQueueSize = 8;

function success<T>(value: T, message: string): OperationResult<T> {
  return { ok: true, value, message };
}

function failure<T>(message: string): OperationResult<T> {
  return { ok: false, message };
}

function isValidValue(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function parseStructureInteger(input: string): number | null {
  const trimmed = input.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;

  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function createStack(values: readonly number[] = []): StackState {
  let top: StackNode | null = null;
  for (const value of values) {
    top = { value, next: top };
  }
  return { top, size: values.length };
}

export function stackValues(stack: StackState): number[] {
  const values: number[] = [];
  let current = stack.top;
  while (current !== null) {
    values.push(current.value);
    current = current.next;
  }
  return values;
}

export function pushStack(
  stack: StackState,
  value: number,
): OperationResult<StackState> {
  if (!isValidValue(value)) return failure("Enter a valid whole-number value.");
  if (stack.size >= maximumStackSize) {
    return failure(`The stack is at its maximum capacity of ${maximumStackSize}.`);
  }

  return success(
    { top: { value, next: stack.top }, size: stack.size + 1 },
    `Pushed ${value} onto the top of the stack.`,
  );
}

export function popStack(
  stack: StackState,
): OperationResult<StackChange> {
  if (stack.top === null) return failure("The stack is empty; there is nothing to pop.");

  const value = stack.top.value;
  return success(
    { stack: { top: stack.top.next, size: stack.size - 1 }, value },
    `Popped ${value} from the top of the stack.`,
  );
}

export function peekStack(
  stack: StackState,
): OperationResult<number> {
  const value = stack.top?.value;
  if (value === undefined) return failure("The stack is empty; there is no top value.");
  return success(value, `The top value is ${value}; the stack was not changed.`);
}

export function createQueue(
  capacity = maximumQueueSize,
  values: readonly number[] = [],
): QueueState {
  let queue: QueueState = {
    slots: Array.from({ length: capacity }, () => null),
    frontIndex: 0,
    size: 0,
  };
  for (const value of values) {
    const result = enqueue(queue, value);
    if (!result.ok) throw new RangeError(result.message);
    queue = result.value;
  }
  return queue;
}

export function enqueue(
  queue: QueueState,
  value: number,
): OperationResult<QueueState> {
  if (!isValidValue(value)) return failure("Enter a valid whole-number value.");
  if (queue.size >= queue.slots.length) {
    return failure(`The queue is at its maximum capacity of ${queue.slots.length}.`);
  }

  const rearIndex = (queue.frontIndex + queue.size) % queue.slots.length;
  const slots = [...queue.slots];
  slots[rearIndex] = value;
  return success(
    { slots, frontIndex: queue.frontIndex, size: queue.size + 1 },
    `Enqueued ${value} at the rear of the queue.`,
  );
}

export function dequeue(
  queue: QueueState,
): OperationResult<QueueChange> {
  if (queue.size === 0) return failure("The queue is empty; there is nothing to dequeue.");

  const value = queue.slots[queue.frontIndex];
  if (value === null || value === undefined) {
    return failure("The queue state is invalid: the front slot is empty.");
  }

  const slots = [...queue.slots];
  slots[queue.frontIndex] = null;
  const size = queue.size - 1;
  const frontIndex = size === 0
    ? 0
    : (queue.frontIndex + 1) % queue.slots.length;
  return success(
    { queue: { slots, frontIndex, size }, value },
    `Dequeued ${value} from the front of the queue.`,
  );
}

export function peekQueueFront(
  queue: QueueState,
): OperationResult<number> {
  if (queue.size === 0) return failure("The queue is empty; there is no front value.");
  const value = queue.slots[queue.frontIndex];
  if (value === null || value === undefined) {
    return failure("The queue state is invalid: the front slot is empty.");
  }
  return success(value, `The front value is ${value}; the queue was not changed.`);
}

export function peekQueueRear(
  queue: QueueState,
): OperationResult<number> {
  if (queue.size === 0) return failure("The queue is empty; there is no rear value.");
  const rearIndex = (queue.frontIndex + queue.size - 1) % queue.slots.length;
  const value = queue.slots[rearIndex];
  if (value === null || value === undefined) {
    return failure("The queue state is invalid: the rear slot is empty.");
  }
  return success(value, `The rear value is ${value}; the queue was not changed.`);
}
