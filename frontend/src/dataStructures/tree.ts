export type TreeNode = Readonly<{
  value: number;
  left: TreeNode | null;
  right: TreeNode | null;
}>;

export type TreeOperationResult<T> =
  | {
      ok: true;
      value: T;
      visited: readonly number[];
      message: string;
    }
  | {
      ok: false;
      visited: readonly number[];
      message: string;
    };

export type TreeNodeInfo = {
  value: number;
  parent: number | null;
  left: number | null;
  right: number | null;
  depth: number;
  height: number;
  isLeaf: boolean;
};

export type TreeTraversal =
  | "preorder"
  | "inorder"
  | "postorder"
  | "level-order";

function success<T>(
  value: T,
  visited: readonly number[],
  message: string,
): TreeOperationResult<T> {
  return { ok: true, value, visited, message };
}

function failure<T>(
  visited: readonly number[],
  message: string,
): TreeOperationResult<T> {
  return { ok: false, visited, message };
}

export function parseTreeInteger(input: string): number | null {
  const trimmed = input.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function treeNodeCount(root: TreeNode | null): number {
  if (root === null) return 0;
  return 1 + treeNodeCount(root.left) + treeNodeCount(root.right);
}

export function treeHeight(root: TreeNode | null): number {
  if (root === null) return -1;
  return 1 + Math.max(treeHeight(root.left), treeHeight(root.right));
}

export function getTreeNodeInfo(
  root: TreeNode | null,
  value: number,
): TreeNodeInfo | null {
  function find(
    node: TreeNode | null,
    parent: number | null,
    depth: number,
  ): TreeNodeInfo | null {
    if (node === null) return null;
    if (node.value === value) {
      return {
        value: node.value,
        parent,
        left: node.left?.value ?? null,
        right: node.right?.value ?? null,
        depth,
        height: treeHeight(node),
        isLeaf: node.left === null && node.right === null,
      };
    }
    return find(node.left, node.value, depth + 1)
      ?? find(node.right, node.value, depth + 1);
  }

  return find(root, null, 0);
}

export function insertBST(
  root: TreeNode | null,
  value: number,
): TreeOperationResult<TreeNode> {
  if (!Number.isSafeInteger(value)) {
    return failure([], "Enter a valid whole-number value to insert.");
  }

  const visited: number[] = [];
  const path: Array<{ node: TreeNode; direction: "left" | "right" }> = [];
  let current = root;
  while (current !== null) {
    const node = current;
    visited.push(node.value);
    if (value === node.value) {
      return failure(
        visited,
        `${value} is already in the BST; duplicates are not allowed.`,
      );
    }
    const direction = value < node.value ? "left" : "right";
    path.push({ node, direction });
    current = node[direction];
  }

  let nextRoot: TreeNode = { value, left: null, right: null };
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const { node, direction } = path[index];
    nextRoot = direction === "left"
      ? { ...node, left: nextRoot }
      : { ...node, right: nextRoot };
  }
  return success(nextRoot, [...visited, value], `Inserted ${value} into the BST.`);
}

export function searchBST(
  root: TreeNode | null,
  value: number,
): TreeOperationResult<number | null> {
  if (!Number.isSafeInteger(value)) {
    return failure([], "Enter a valid whole-number value to search for.");
  }

  const visited: number[] = [];
  let current = root;
  while (current !== null) {
    visited.push(current.value);
    if (current.value === value) {
      return success(value, visited, `Found ${value} in the BST.`);
    }
    current = value < current.value ? current.left : current.right;
  }
  return success(null, visited, `${value} is not in the BST.`);
}

export function deleteBST(
  root: TreeNode | null,
  value: number,
): TreeOperationResult<TreeNode | null> {
  if (!Number.isSafeInteger(value)) {
    return failure([], "Enter a valid whole-number value to delete.");
  }

  const visited: number[] = [];

  function removeMinimum(node: TreeNode): TreeNode | null {
    if (node.left === null) return node.right;
    return { ...node, left: removeMinimum(node.left) };
  }

  function remove(node: TreeNode | null): TreeNode | null {
    if (node === null) return null;
    visited.push(node.value);
    if (value < node.value) return { ...node, left: remove(node.left) };
    if (value > node.value) return { ...node, right: remove(node.right) };

    if (node.left === null) return node.right;
    if (node.right === null) return node.left;

    let successor = node.right;
    visited.push(successor.value);
    while (successor.left !== null) {
      successor = successor.left;
      visited.push(successor.value);
    }
    return {
      value: successor.value,
      left: node.left,
      right: removeMinimum(node.right),
    };
  }

  const nextRoot = remove(root);
  if (!visited.some((visitedValue) => visitedValue === value)) {
    return failure(visited, `${value} is not in the BST; nothing was deleted.`);
  }
  return success(nextRoot, visited, `Deleted ${value} from the BST.`);
}

export function traverseTree(
  root: TreeNode | null,
  traversal: TreeTraversal,
): number[] {
  if (root === null) return [];

  if (traversal === "level-order") {
    const result: number[] = [];
    const queue: TreeNode[] = [root];
    for (let index = 0; index < queue.length; index += 1) {
      const node = queue[index];
      result.push(node.value);
      if (node.left !== null) queue.push(node.left);
      if (node.right !== null) queue.push(node.right);
    }
    return result;
  }

  const result: number[] = [];
  function visit(node: TreeNode | null): void {
    if (node === null) return;
    if (traversal === "preorder") result.push(node.value);
    visit(node.left);
    if (traversal === "inorder") result.push(node.value);
    visit(node.right);
    if (traversal === "postorder") result.push(node.value);
  }
  visit(root);
  return result;
}

export function createBST(values: readonly number[]): TreeNode | null {
  let root: TreeNode | null = null;
  for (const value of values) {
    const result = insertBST(root, value);
    if (!result.ok) throw new RangeError(result.message);
    root = result.value;
  }
  return root;
}
