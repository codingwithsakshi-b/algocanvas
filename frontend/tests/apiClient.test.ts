import assert from "node:assert/strict";
import test from "node:test";
import {
  getLearningProgress,
  getLearningGoal,
  getCurrentUser,
  getHealth,
  deleteLearningGoal,
  saveLearningGoal,
  saveLearningProgress,
  signInWithGoogle,
  signOut,
} from "../src/api/client.ts";

test("getHealth requests and returns the API health response", async (context) => {
  let requestedUrl: string | undefined;
  context.mock.method(globalThis, "fetch", async (input: URL | RequestInfo) => {
    requestedUrl = String(input);
    return new Response(
      JSON.stringify({ status: "OK", message: "AlgoCanvas API is healthy" }),
      { headers: { "Content-Type": "application/json" } },
    );
  });

  assert.deepEqual(await getHealth(), {
    status: "OK",
    message: "AlgoCanvas API is healthy",
  });
  assert.equal(requestedUrl, "/api/health");
});

test("getHealth reports HTTP errors", async (context) => {
  context.mock.method(globalThis, "fetch", async () =>
    new Response("Unavailable", { status: 503, statusText: "Service Unavailable" }),
  );

  await assert.rejects(getHealth(), {
    message: "AlgoCanvas health request failed with HTTP 503 Service Unavailable",
  });
});

test("getHealth reports network errors", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("fetch failed");
  });

  await assert.rejects(getHealth(), {
    message: "Could not reach the AlgoCanvas API: fetch failed",
  });
});

test("getCurrentUser includes cookies and returns the safe user profile", async (context) => {
  let requestedUrl: string | undefined;
  let requestInit: RequestInit | undefined;
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      requestedUrl = String(input);
      requestInit = init;
      return new Response(
        JSON.stringify({
          user: {
            id: "user-123",
            name: "Ada Lovelace",
            email: "ada@example.com",
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  );

  assert.deepEqual(await getCurrentUser(), {
    id: "user-123",
    name: "Ada Lovelace",
    email: "ada@example.com",
  });
  assert.equal(requestedUrl, "/api/auth/me");
  assert.equal(requestInit?.credentials, "include");
});

test("getCurrentUser treats an unauthorized session as signed out", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 401 }),
  );

  assert.equal(await getCurrentUser(), null);
});

test("signInWithGoogle sends only the ID token and includes credentials", async (context) => {
  let requestInit: RequestInit | undefined;
  context.mock.method(
    globalThis,
    "fetch",
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      requestInit = init;
      return new Response(
        JSON.stringify({
          user: {
            id: "user-123",
            name: "Ada Lovelace",
            email: "ada@example.com",
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    },
  );

  assert.equal(
    (await signInWithGoogle("test-id-token")).email,
    "ada@example.com",
  );
  assert.equal(requestInit?.credentials, "include");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    idToken: "test-id-token",
  });
});

test("signOut includes credentials", async (context) => {
  let requestInit: RequestInit | undefined;
  context.mock.method(
    globalThis,
    "fetch",
    async (_input: URL | RequestInfo, init?: RequestInit) => {
      requestInit = init;
      return new Response(null, { status: 204 });
    },
  );

  await signOut();
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.credentials, "include");
});

test("getLearningProgress requests the signed-in user's records with cookies", async (context) => {
  let requestedUrl: string | undefined;
  let requestInit: RequestInit | undefined;
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      requestedUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ progress: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  assert.deepEqual(await getLearningProgress(), []);
  assert.equal(requestedUrl, "/api/learning-progress");
  assert.equal(requestInit?.credentials, "include");
});

test("saveLearningProgress sends status without a browser-supplied user ID", async (context) => {
  let requestedUrl: string | undefined;
  let requestInit: RequestInit | undefined;
  const progress = {
    topicId: "sorting-bubble-sort",
    topicName: "Bubble Sort",
    category: "sorting",
    status: "in-progress",
    lastVisitedAt: "2026-10-26T00:00:00.000Z",
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: "2026-10-26T00:00:00.000Z",
  };
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      requestedUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify({ progress }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  assert.deepEqual(await saveLearningProgress(progress), progress);
  assert.equal(requestedUrl, "/api/learning-progress/sorting-bubble-sort");
  assert.equal(requestInit?.method, "PUT");
  assert.equal(requestInit?.credentials, "include");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    topicName: "Bubble Sort",
    category: "sorting",
    status: "in-progress",
  });
});

test("getLearningGoal includes credentials and returns the signed-in user's goal", async (context) => {
  let requestInit: RequestInit | undefined;
  const goal = {
    targetTopics: 4,
    durationDays: 21,
    startedAt: "2026-10-27T00:00:00.000Z",
    deadlineAt: "2026-11-17T00:00:00.000Z",
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
  };
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      assert.equal(String(input), "/api/learning-goal");
      requestInit = init;
      return new Response(JSON.stringify({ goal }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  assert.deepEqual(await getLearningGoal(), goal);
  assert.equal(requestInit?.credentials, "include");
});

test("saveLearningGoal persists only goal settings with session credentials", async (context) => {
  let requestInit: RequestInit | undefined;
  const goal = {
    targetTopics: 3,
    durationDays: 10,
    startedAt: "2026-10-27T00:00:00.000Z",
    deadlineAt: "2026-11-06T00:00:00.000Z",
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
  };
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      assert.equal(String(input), "/api/learning-goal");
      requestInit = init;
      return new Response(JSON.stringify({ goal }), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  assert.deepEqual(
    await saveLearningGoal({ targetTopics: 3, durationDays: 10 }),
    goal,
  );
  assert.equal(requestInit?.method, "PUT");
  assert.equal(requestInit?.credentials, "include");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    targetTopics: 3,
    durationDays: 10,
  });
});

test("deleteLearningGoal sends an authenticated DELETE request", async (context) => {
  let requestInit: RequestInit | undefined;
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      assert.equal(String(input), "/api/learning-goal");
      requestInit = init;
      return new Response(null, { status: 204 });
    },
  );

  await deleteLearningGoal();
  assert.equal(requestInit?.method, "DELETE");
  assert.equal(requestInit?.credentials, "include");
});
