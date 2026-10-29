import type { LearningProgressCategory } from "../api/client";
import type { GraphAlgorithm } from "../algorithms/graph";

export interface LearningTopic {
  topicId: string;
  topicName: string;
  category: LearningProgressCategory;
  section: "sorting" | "structures" | "graphs";
  algorithm?: string;
  structure?: "arrays" | "linked-lists" | "stacks-queues" | "trees";
}

export function graphAlgorithmForTopic(
  topicId: string,
): GraphAlgorithm | undefined {
  switch (topicId) {
    case "graphs-bfs":
      return "bfs";
    case "graphs-dfs":
      return "dfs";
    case "graphs-dijkstra":
      return "dijkstra";
    default:
      return undefined;
  }
}

export const learningTopics: LearningTopic[] = [
  {
    topicId: "sorting-bubble-sort",
    topicName: "Bubble Sort",
    category: "sorting",
    section: "sorting",
    algorithm: "Bubble Sort",
  },
  {
    topicId: "sorting-selection-sort",
    topicName: "Selection Sort",
    category: "sorting",
    section: "sorting",
    algorithm: "Selection Sort",
  },
  {
    topicId: "sorting-insertion-sort",
    topicName: "Insertion Sort",
    category: "sorting",
    section: "sorting",
    algorithm: "Insertion Sort",
  },
  {
    topicId: "sorting-merge-sort",
    topicName: "Merge Sort",
    category: "sorting",
    section: "sorting",
    algorithm: "Merge Sort",
  },
  {
    topicId: "sorting-quick-sort",
    topicName: "Quick Sort",
    category: "sorting",
    section: "sorting",
    algorithm: "Quick Sort",
  },
  {
    topicId: "data-structures-arrays",
    topicName: "Arrays",
    category: "data-structures",
    section: "structures",
    structure: "arrays",
  },
  {
    topicId: "data-structures-linked-lists",
    topicName: "Linked Lists",
    category: "data-structures",
    section: "structures",
    structure: "linked-lists",
  },
  {
    topicId: "data-structures-stacks-queues",
    topicName: "Stacks & Queues",
    category: "data-structures",
    section: "structures",
    structure: "stacks-queues",
  },
  {
    topicId: "data-structures-trees",
    topicName: "Trees",
    category: "data-structures",
    section: "structures",
    structure: "trees",
  },
  {
    topicId: "graphs-bfs",
    topicName: "Breadth-first search",
    category: "graphs",
    section: "graphs",
  },
  {
    topicId: "graphs-dfs",
    topicName: "Depth-first search",
    category: "graphs",
    section: "graphs",
  },
  {
    topicId: "graphs-dijkstra",
    topicName: "Dijkstra shortest path",
    category: "graphs",
    section: "graphs",
  },
];
