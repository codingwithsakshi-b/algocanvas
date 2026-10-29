import assert from "node:assert/strict";
import test from "node:test";
import {
  CodeExecutionApiError,
  executeCode,
} from "../src/api/codeExecution.ts";

const successfulResult = {
  compiler: "cpython-3.13.8",
  status: "Accepted",
  stdout: "hello\n",
  stderr: null,
  compileOutput: null,
  message: null,
  time: "0.001",
  memory: 512,
  exitCode: 0,
  exitSignal: null,
  outputTruncated: false,
};

test("executeCode sends only to the backend with the selected source and stdin", async (context) => {
  let requestedUrl: string | undefined;
  let requestInit: RequestInit | undefined;
  context.mock.method(
    globalThis,
    "fetch",
    async (input: URL | RequestInfo, init?: RequestInit) => {
      requestedUrl = String(input);
      requestInit = init;
      return new Response(JSON.stringify(successfulResult), {
        headers: { "Content-Type": "application/json" },
      });
    },
  );

  assert.deepEqual(
    await executeCode({
      language: "python",
      source: "print(input())",
      stdin: "hello",
    }),
    successfulResult,
  );
  assert.equal(requestedUrl, "/api/code-execution");
  assert.equal(requestInit?.method, "POST");
  assert.equal(requestInit?.credentials, "include");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    language: "python",
    source: "print(input())",
    stdin: "hello",
  });
});

test("executeCode preserves provider and rate-limit errors", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        JSON.stringify({
          code: "provider_unavailable",
          message: "Wandbox is temporarily unavailable. Try again later.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", "Retry-After": "4" },
        },
      ),
  );

  await assert.rejects(
    executeCode({ language: "java", source: "class Main {}", stdin: "" }),
    (error: unknown) =>
      error instanceof CodeExecutionApiError &&
      error.httpStatus === 503 &&
      error.code === "provider_unavailable" &&
      error.retryAfterSeconds === 4,
  );
});

test("executeCode rejects malformed successful provider responses", async (context) => {
  context.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ status: "Accepted", stdout: "fake" }), {
        headers: { "Content-Type": "application/json" },
      }),
  );

  await assert.rejects(
    executeCode({ language: "c", source: "int main() {}", stdin: "" }),
    {
      name: "CodeExecutionApiError",
      code: "invalid_execution_response",
    },
  );
});

test("executeCode reports network and invalid JSON failures", async (context) => {
  let fetchCalls = 0;
  context.mock.method(globalThis, "fetch", async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) throw new TypeError("fetch failed");
    return new Response("{", {
      headers: { "Content-Type": "application/json" },
    });
  });
  await assert.rejects(executeCode({ language: "cpp", source: "int main() {}", stdin: "" }), {
    code: "backend_unavailable",
  });

  await assert.rejects(
    executeCode({ language: "cpp", source: "int main() {}", stdin: "" }),
    { code: "invalid_execution_response" },
  );
});
