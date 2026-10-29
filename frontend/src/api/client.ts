export interface HealthResponse {
  status: "OK";
  message: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export type LearningProgressCategory = "sorting" | "data-structures" | "graphs";
export type LearningProgressStatus =
  | "not-started"
  | "in-progress"
  | "completed";

export interface LearningProgressRecord {
  topicId: string;
  topicName: string;
  category: LearningProgressCategory;
  status: LearningProgressStatus;
  lastVisitedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LearningGoal {
  targetTopics: number;
  durationDays: number;
  startedAt: string;
  deadlineAt: string;
  createdAt: string;
  updatedAt: string;
}

function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    value.status === "OK" &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function isAuthUser(value: unknown): value is AuthUser {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "email" in value &&
    typeof value.email === "string" &&
    (!("avatar" in value) || typeof value.avatar === "string")
  );
}

function isLearningProgressRecord(
  value: unknown,
): value is LearningProgressRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "topicId" in value &&
    typeof value.topicId === "string" &&
    "topicName" in value &&
    typeof value.topicName === "string" &&
    "category" in value &&
    (value.category === "sorting" ||
      value.category === "data-structures" ||
      value.category === "graphs") &&
    "status" in value &&
    (value.status === "not-started" ||
      value.status === "in-progress" ||
      value.status === "completed") &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string" &&
    (!("lastVisitedAt" in value) ||
      typeof value.lastVisitedAt === "string") &&
    (!("completedAt" in value) || typeof value.completedAt === "string")
  );
}

function isLearningGoal(value: unknown): value is LearningGoal {
  return (
    typeof value === "object" &&
    value !== null &&
    "targetTopics" in value &&
    typeof value.targetTopics === "number" &&
    Number.isInteger(value.targetTopics) &&
    "durationDays" in value &&
    typeof value.durationDays === "number" &&
    Number.isInteger(value.durationDays) &&
    "startedAt" in value &&
    typeof value.startedAt === "string" &&
    "deadlineAt" in value &&
    typeof value.deadlineAt === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "updatedAt" in value &&
    typeof value.updatedAt === "string"
  );
}

async function readLearningGoal(response: Response): Promise<LearningGoal | null> {
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Learning goal endpoint returned invalid JSON", {
      cause: error,
    });
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("goal" in data) ||
    (data.goal !== null && !isLearningGoal(data.goal))
  ) {
    throw new Error("Learning goal endpoint returned an invalid goal");
  }
  return data.goal;
}

async function readAuthUser(response: Response): Promise<AuthUser> {
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Authentication endpoint returned invalid JSON", {
      cause: error,
    });
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("user" in data) ||
    !isAuthUser(data.user)
  ) {
    throw new Error("Authentication endpoint returned an invalid user profile");
  }

  return data.user;
}

async function authError(response: Response): Promise<Error> {
  try {
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string"
    ) {
      return new Error(data.message);
    }
  } catch {
    // Use the status below when the server does not return a readable error body.
  }
  return new Error(`Authentication request failed with HTTP ${response.status}`);
}

async function readProgressRecord(response: Response): Promise<LearningProgressRecord> {
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Learning progress endpoint returned invalid JSON", {
      cause: error,
    });
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("progress" in data) ||
    !isLearningProgressRecord(data.progress)
  ) {
    throw new Error("Learning progress endpoint returned an invalid record");
  }
  return data.progress;
}

async function readProgressList(response: Response): Promise<LearningProgressRecord[]> {
  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Learning progress endpoint returned invalid JSON", {
      cause: error,
    });
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("progress" in data) ||
    !Array.isArray(data.progress) ||
    !data.progress.every(isLearningProgressRecord)
  ) {
    throw new Error("Learning progress endpoint returned invalid records");
  }
  return data.progress;
}

export async function getHealth(): Promise<HealthResponse> {
  let response: Response;

  try {
    response = await fetch("/api/health");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the AlgoCanvas API: ${detail}`, {
      cause: error,
    });
  }

  if (!response.ok) {
    const statusText = response.statusText ? ` ${response.statusText}` : "";
    throw new Error(
      `AlgoCanvas health request failed with HTTP ${response.status}${statusText}`,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("AlgoCanvas health endpoint returned invalid JSON", {
      cause: error,
    });
  }

  if (!isHealthResponse(data)) {
    throw new Error("AlgoCanvas health endpoint returned an invalid response");
  }

  return data;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  let response: Response;
  try {
    response = await fetch("/api/auth/me", { credentials: "include" });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not check the sign-in session: ${detail}`, {
      cause: error,
    });
  }

  if (response.status === 401) return null;
  if (!response.ok) throw await authError(response);
  return readAuthUser(response);
}

export async function signInWithGoogle(idToken: string): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch("/api/auth/google", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the sign-in service: ${detail}`, {
      cause: error,
    });
  }

  if (!response.ok) throw await authError(response);
  return readAuthUser(response);
}

export async function signOut(): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not reach the sign-out service: ${detail}`, {
      cause: error,
    });
  }

  if (!response.ok) throw await authError(response);
}

export async function getLearningProgress(): Promise<LearningProgressRecord[]> {
  let response: Response;
  try {
    response = await fetch("/api/learning-progress", {
      credentials: "include",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load learning progress: ${detail}`, {
      cause: error,
    });
  }

  if (!response.ok) throw await authError(response);
  return readProgressList(response);
}

export async function saveLearningProgress(input: {
  topicId: string;
  topicName: string;
  category: LearningProgressCategory;
  status: LearningProgressStatus;
}): Promise<LearningProgressRecord> {
  let response: Response;
  try {
    response = await fetch(
      `/api/learning-progress/${encodeURIComponent(input.topicId)}`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicName: input.topicName,
          category: input.category,
          status: input.status,
        }),
      },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not save learning progress: ${detail}`, {
      cause: error,
    });
  }

  if (!response.ok) throw await authError(response);
  return readProgressRecord(response);
}

export async function getLearningGoal(): Promise<LearningGoal | null> {
  let response: Response;
  try {
    response = await fetch("/api/learning-goal", {
      credentials: "include",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load learning goal: ${detail}`, { cause: error });
  }

  if (!response.ok) throw await authError(response);
  return readLearningGoal(response);
}

export async function saveLearningGoal(input: {
  targetTopics: number;
  durationDays: number;
}): Promise<LearningGoal> {
  let response: Response;
  try {
    response = await fetch("/api/learning-goal", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not save learning goal: ${detail}`, { cause: error });
  }

  if (!response.ok) throw await authError(response);
  const goal = await readLearningGoal(response);
  if (!goal) throw new Error("Learning goal endpoint returned no saved goal");
  return goal;
}

export async function deleteLearningGoal(): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/learning-goal", {
      method: "DELETE",
      credentials: "include",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not delete learning goal: ${detail}`, { cause: error });
  }

  if (!response.ok) throw await authError(response);
}
