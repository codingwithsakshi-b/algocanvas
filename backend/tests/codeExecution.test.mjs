import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import test from "node:test";
import {
  createCodeExecutionRouter,
  executeWithWandbox,
  resolveWandboxCompiler,
  validateCodeExecutionInput,
} from "../src/routes/codeExecution.ts";

const allowedOrigins = new Set(["http://localhost:5173"]);
const compilerList = [
  { language: "C++", name: "gcc-13.2.0" },
  { language: "C++", name: "gcc-head" },
  { language: "C", name: "gcc-13.2.0-c" },
  { language: "Python", name: "cpython-3.13.8" },
  { language: "Java", name: "openjdk-jdk-21+35" },
];
const baseOptions = {
  allowedOrigins,
  timeoutMs: 200,
};

function providerResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function compileResult(overrides = {}) {
  return {
    status: "0",
    signal: "",
    compiler_output: "",
    compiler_error: "",
    compiler_message: "",
    program_output: "",
    program_error: "",
    program_message: "",
    ...overrides,
  };
}

async function createExecutionServer(context, routerOptions = baseOptions) {
  const app = express();
  app.use(express.json({ limit: "48kb" }));
  app.use("/api/code-execution", createCodeExecutionRouter(routerOptions));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() =>
    new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  );
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    url: `http://127.0.0.1:${address.port}/api/code-execution`,
    headers: {
      Origin: "http://localhost:5173",
      "Content-Type": "application/json",
    },
  };
}

test("execution request validation accepts supported language, source, and stdin", () => {
  assert.deepEqual(
    validateCodeExecutionInput({
      language: "python",
      source: "print(input())",
      stdin: "hello",
    }),
    {
      valid: true,
      value: {
        language: "python",
        source: "print(input())",
        stdin: "hello",
      },
    },
  );
});

test("execution request validation rejects unknown languages and missing source", () => {
  assert.equal(validateCodeExecutionInput(null).valid, false);
  assert.equal(
    validateCodeExecutionInput({
      language: "javascript",
      source: "console.log(1)",
    }).valid,
    false,
  );
  assert.equal(
    validateCodeExecutionInput({ language: "cpp", source: "  " }).valid,
    false,
  );
});

test("execution request validation limits UTF-8 source and stdin sizes", () => {
  assert.equal(
    validateCodeExecutionInput({
      language: "c",
      source: "é".repeat(16_385),
    }).valid,
    false,
  );
  assert.equal(
    validateCodeExecutionInput({
      language: "java",
      source: "class Main {}",
      stdin: "x".repeat(8 * 1024 + 1),
    }).valid,
    false,
  );
});

test("compiler selection resolves IDs from the Wandbox list and prefers stable versions", () => {
  assert.equal(resolveWandboxCompiler("cpp", compilerList), "gcc-13.2.0");
  assert.equal(resolveWandboxCompiler("c", compilerList), "gcc-13.2.0-c");
  assert.equal(resolveWandboxCompiler("python", compilerList), "cpython-3.13.8");
  assert.equal(resolveWandboxCompiler("java", compilerList), "openjdk-jdk-21+35");
  assert.throws(
    () => resolveWandboxCompiler("python", [{ language: "C++", name: "gcc-13.2.0" }]),
    (error) => error.code === "compiler_unavailable",
  );
  assert.throws(
    () => resolveWandboxCompiler("java", null),
    (error) => error.code === "provider_invalid_response",
  );
});

test("Wandbox discovers the C++ compiler, sends documented fields, and maps output", async () => {
  const calls = [];
  const result = await executeWithWandbox(
    { language: "cpp", source: 'int main(){return 0;}', stdin: "input" },
    {
      ...baseOptions,
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init });
        return init.method === "GET"
          ? providerResponse(compilerList)
          : providerResponse(
              compileResult({
                compiler_message: "compiler warning",
                compiler_error: "compiler warning",
                program_output: "hello\n",
                program_message: "hello\n",
              }),
            );
      },
    },
  );

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://wandbox.org/api/list.json");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[1].url, "https://wandbox.org/api/compile.json");
  assert.equal(calls[1].init.method, "POST");
  assert.equal(calls[1].init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    compiler: "gcc-13.2.0",
    code: "int main(){return 0;}",
    stdin: "input",
    save: false,
  });
  assert.equal(result.compiler, "gcc-13.2.0");
  assert.equal(result.status, "Accepted");
  assert.equal(result.stdout, "hello\n");
  assert.equal(result.compileOutput, "compiler warning");
  assert.equal(result.exitCode, 0);
  assert.equal(result.time, null);
});

test("Wandbox selects each language compiler from the API list", async () => {
  const expected = new Map([
    ["cpp", "gcc-13.2.0"],
    ["c", "gcc-13.2.0-c"],
    ["python", "cpython-3.13.8"],
    ["java", "openjdk-jdk-21+35"],
  ]);
  for (const [language, compiler] of expected) {
    let requestBody;
    await executeWithWandbox(
      { language, source: "source", stdin: "" },
      {
        ...baseOptions,
        fetcher: async (_url, init) => {
          if (init.method === "GET") return providerResponse(compilerList);
          requestBody = JSON.parse(init.body);
          return providerResponse(compileResult());
        },
      },
    );
    assert.equal(requestBody.compiler, compiler);
  }
});

test("Wandbox maps compilation failures, runtime errors, and signals", async () => {
  const results = [
    {
      api: compileResult({
        status: "1",
        compiler_error: "error: expected ';'",
        compiler_message: "error: expected ';'",
      }),
      expectedStatus: "Compilation Error",
    },
    {
      api: compileResult({
        status: "2",
        program_output: "partial",
        program_error: "Traceback",
        program_message: "Traceback",
      }),
      expectedStatus: "Runtime Error",
    },
    {
      api: compileResult({
        status: "0",
        signal: "SIGKILL",
      }),
      expectedStatus: "Runtime Error",
    },
  ];
  for (const item of results) {
    const result = await executeWithWandbox(
      { language: "python", source: "source", stdin: "" },
      {
        ...baseOptions,
        fetcher: async (_url, init) =>
          init.method === "GET"
            ? providerResponse(compilerList)
            : providerResponse(item.api),
      },
    );
    assert.equal(result.status, item.expectedStatus);
    assert.equal(result.stderr, item.api.program_error);
    assert.equal(result.compileOutput, item.api.compiler_message);
    assert.equal(result.exitSignal, item.api.signal || null);
  }
});

test("provider timeouts, HTTP failures, and malformed payloads are explicit", async () => {
  await assert.rejects(
    executeWithWandbox(
      { language: "python", source: "print(1)", stdin: "" },
      {
        ...baseOptions,
        fetcher: async () => {
          const error = new Error("deadline");
          error.name = "TimeoutError";
          throw error;
        },
      },
    ),
    (error) => error.httpStatus === 504 && error.code === "provider_timeout",
  );
  await assert.rejects(
    executeWithWandbox(
      { language: "python", source: "print(1)", stdin: "" },
      {
        ...baseOptions,
        fetcher: async () => new Response("down", { status: 503 }),
      },
    ),
    (error) => error.httpStatus === 503 && error.code === "provider_unavailable",
  );
  await assert.rejects(
    executeWithWandbox(
      { language: "python", source: "print(1)", stdin: "" },
      {
        ...baseOptions,
        fetcher: async () => new Response("rate limit", { status: 429 }),
      },
    ),
    (error) => error.httpStatus === 429 && error.code === "provider_rate_limited",
  );
  await assert.rejects(
    executeWithWandbox(
      { language: "python", source: "print(1)", stdin: "" },
      {
        ...baseOptions,
        fetcher: async () => {
          throw new TypeError("fetch failed");
        },
      },
    ),
    (error) => error.httpStatus === 503 && error.code === "provider_unavailable",
  );
  await assert.rejects(
    executeWithWandbox(
      { language: "java", source: "class Main {}", stdin: "" },
      {
        ...baseOptions,
        fetcher: async () => new Response("{"),
      },
    ),
    (error) => error.code === "provider_invalid_response",
  );
  await assert.rejects(
    executeWithWandbox(
      { language: "java", source: "class Main {}", stdin: "" },
      {
        ...baseOptions,
        fetcher: async (_url, init) =>
          init.method === "GET"
            ? providerResponse(compilerList)
            : providerResponse({ status: "not-an-exit-code" }),
      },
    ),
    (error) => error.code === "provider_invalid_response",
  );
  await assert.rejects(
    executeWithWandbox(
      { language: "java", source: "class Main {}", stdin: "" },
      {
        ...baseOptions,
        fetcher: async (_url, init) =>
          init.method === "GET"
            ? providerResponse(compilerList)
            : new Response("x".repeat(257 * 1024)),
      },
    ),
    (error) => error.code === "provider_response_too_large",
  );
});

test("execution endpoint validates origin and payload before contacting Wandbox", async (context) => {
  let providerCalls = 0;
  const { url, headers } = await createExecutionServer(context, {
    ...baseOptions,
    fetcher: async () => {
      providerCalls += 1;
      return providerResponse(compilerList);
    },
  });

  const invalidLanguage = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ language: "rust", source: "fn main() {}" }),
  });
  assert.equal(invalidLanguage.status, 400);
  assert.equal((await invalidLanguage.json()).code, "invalid_request");

  const missingOrigin = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "python", source: "print(1)" }),
  });
  assert.equal(missingOrigin.status, 403);
  assert.equal(providerCalls, 0);
});

test("endpoint returns Wandbox execution output", async (context) => {
  const { url, headers } = await createExecutionServer(context, {
    ...baseOptions,
    fetcher: async (_url, init) =>
      init.method === "GET"
        ? providerResponse(compilerList)
        : providerResponse(
            compileResult({
              program_output: "42\n",
              program_message: "42\n",
            }),
          ),
  });
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      language: "python",
      source: "print(42)",
      stdin: "",
    }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.compiler, "cpython-3.13.8");
  assert.equal(result.status, "Accepted");
  assert.equal(result.stdout, "42\n");
});

test("endpoint rate-limits requests from the same client", async (context) => {
  const { url, headers } = await createExecutionServer(context, {
    ...baseOptions,
    maxRequests: 1,
    fetcher: async (_url, init) =>
      init.method === "GET"
        ? providerResponse(compilerList)
        : providerResponse(compileResult()),
  });
  const body = JSON.stringify({ language: "python", source: "print(1)" });
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers,
        body,
      })
    ).status,
    200,
  );
  const limited = await fetch(url, { method: "POST", headers, body });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after") !== null, true);
});

test("Wandbox result text is limited before returning to the UI", async () => {
  const result = await executeWithWandbox(
    { language: "python", source: "print('x')", stdin: "" },
    {
      ...baseOptions,
      fetcher: async (_url, init) =>
        init.method === "GET"
          ? providerResponse(compilerList)
          : providerResponse(
              compileResult({
                program_output: "x".repeat(20_000),
                program_message: "x".repeat(20_000),
              }),
            ),
    },
  );
  assert.equal(result.stdout.length, 16 * 1024);
  assert.equal(result.outputTruncated, true);
});
