import { learningTopics, type LearningTopic } from "./learning/topics.ts";

export type AppPage =
  | "landing"
  | "workspace"
  | "learn"
  | "playground"
  | "profile"
  | "settings";
export type WorkspaceSection = LearningTopic["section"];

export interface AppRoute {
  page: AppPage;
  topicId?: string;
}

const defaultTopic = learningTopics[0];

export function resolveAppRoute(hash: string): AppRoute {
  const [route, topicId] = hash.replace(/^#\/?/, "").split("/");

  if (!route || route === "home") return { page: "landing" };
  if (route === "learn") return { page: "learn" };
  if (route === "playground") return { page: "playground" };
  if (route === "profile") return { page: "profile" };
  if (route === "settings") return { page: "settings" };
  if (route === "workspace") {
    const topic = learningTopics.find((candidate) => candidate.topicId === topicId);
    return {
      page: "workspace",
      topicId: topic?.topicId ?? defaultTopic.topicId,
    };
  }

  const section = route === "structures" ? "structures" : route;
  const sectionTopic = learningTopics.find(
    (topic) => topic.section === section,
  );
  if (sectionTopic) {
    return { page: "workspace", topicId: sectionTopic.topicId };
  }

  return { page: "landing" };
}

export function resolveStartupRoute(
  hash: string,
  isAuthenticated: boolean,
): AppRoute {
  if (isAuthenticated && !hash) return { page: "learn" };
  return resolveAppRoute(hash);
}

export function hashForRoute(route: AppRoute): string {
  if (route.page === "landing") return "#home";
  if (route.page === "learn") return "#learn";
  if (route.page === "playground") return "#playground";
  if (route.page === "profile") return "#profile";
  if (route.page === "settings") return "#settings";
  return `#workspace/${route.topicId ?? defaultTopic.topicId}`;
}
