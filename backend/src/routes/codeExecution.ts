import { Router, type Request } from "express";

export type ExecutionLanguage = "cpp" | "c" | "python" | "java";

export interface CodeExecutionInput {
  language: ExecutionLanguage;
  source: string;
  stdin: string;
}

export interface CodeExecutionResult {
  compiler: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  compileOutput: string | null;
  message: string | null;
  time: string | null;
  memory: number | null;
  exitCode: number | null;
  exitSignal: string | null;
  outputTruncated: boolean;
}

export interface CodeExecutionRouterOptions {
  allowedOrigins: Set<string>;
  fetcher?: typeof fetch;
  maxRequests?: number;
  windowMs?: number;
  timeoutMs?: number;
}

interface WandboxCompiler {
  name?: unknown;
  language?: unknown;
}

interface WandboxCompileResult {
  status?: unknown;
  signal?: unknown;
  compiler_output?: unknown;
  compiler_error?: unknown;
  compiler_message?: unknown;
  program_output?: unknown;
  program_error?: unknown;
  program_message?: unknown;
}

const WANDBOX_API = "https://wandbox.org/api";
const MAX_SOURCE_BYTES = 32 * 1024;
const MAX_STDIN_BYTES = 8 * 1024;
const MAX_RESULT_FIELD_CHARS = 16 * 1024;
const MAX_PROVIDER_RESPONSE_BYTES = 256 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_WINDOW_MS = 60_000;

const languageNames: ExecutionLanguage[] = ["cpp", "c", "python", "java"];

const languageDetails: Record<
  ExecutionLanguage,
  { apiLanguage: string; compilerPattern: RegExp }
> = {
  cpp: { apiLanguage: "C++", compilerPattern: /^(?:gcc|clang)-\d+(?:\.\d+){1,2}$/ },
  c: {
    apiLanguage: "C",
    compilerPattern: /^(?:gcc|clang)-\d+(?:\.\d+){1,2}-c$/,
  },
  python: {
    apiLanguage: "Python",
    compilerPattern: /^cpython-\d+(?:\.\d+){1,2}$/,
  },
  java: {
    apiLanguage: "Java",
    compilerPattern: /^openjdk-jdk-\d+\+\d+$/,
  },
};

export class CodeExecutionError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "CodeExecutionError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validateCodeExecutionInput(
  body: unknown,
): { valid: true; value: CodeExecutionInput } | { valid: false; message: string } {
  if (!isRecord(body)) {
    return { valid: false, message: "A JSON execution request is required." };
  }
  if (
    typeof body.language !== "string" ||
    !languageNames.includes(body.language as ExecutionLanguage)
  ) {
    return {
      valid: false,
      message: "Choose one of the supported languages: C++, C, Python, or Java.",
    };
  }
  if (typeof body.source !== "string" || body.source.trim().length === 0) {
    return { valid: false, message: "Add some source code before running." };
  }
  if (Buffer.byteLength(body.source, "utf8") > MAX_SOURCE_BYTES) {
    return {
      valid: false,
      message: "Source code must be 32 KB or smaller.",
    };
  }
  if (body.stdin !== undefined && typeof body.stdin !== "string") {
    return { valid: false, message: "Standard input must be text." };
  }
  const stdin = body.stdin ?? "";
  if (Buffer.byteLength(stdin, "utf8") > MAX_STDIN_BYTES) {
    return {
      valid: false,
      message: "Standard input must be 8 KB or smaller.",
    };
  }
  return {
    valid: true,
    value: {
      language: body.language as ExecutionLanguage,
      source: body.source,
      stdin,
    },
  };
}

function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function truncateText(value: string | null): {
  value: string | null;
  truncated: boolean;
} {
  if (value === null || value.length <= MAX_RESULT_FIELD_CHARS) {
    return { value, truncated: false };
  }
  return {
    value: value.slice(0, MAX_RESULT_FIELD_CHARS),
    truncated: true,
  };
}

function exitCodeFrom(value: unknown): number | null {
  if (typeof value !== "string" || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function compareCompilerVersions(left: string, right: string): number {
  const leftParts = left.match(/\d+/g)?.map(Number) ?? [];
  const rightParts = right.match(/\d+/g)?.map(Number) ?? [];
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return left.localeCompare(right);
}

export function resolveWandboxCompiler(
  language: ExecutionLanguage,
  compilerList: unknown,
): string {
  if (!Array.isArray(compilerList)) {
    throw new CodeExecutionError(
      "Wandbox returned an invalid compiler list. Try again later.",
      502,
      "provider_invalid_response",
    );
  }
  const details = languageDetails[language];
  const candidates = compilerList.filter(
    (entry): entry is WandboxCompiler =>
      isRecord(entry) &&
      entry.language === details.apiLanguage &&
      typeof entry.name === "string" &&
      details.compilerPattern.test(entry.name),
  );
  candidates.sort((left, right) =>
    compareCompilerVersions(String(left.name), String(right.name)),
  );
  const compiler = candidates[0]?.name;
  if (typeof compiler !== "string") {
    throw new CodeExecutionError(
      `Wandbox currently has no supported compiler for ${details.apiLanguage}.`,
      503,
      "compiler_unavailable",
    );
  }
  return compiler;
}

function readOutputText(
  result: WandboxCompileResult,
  field: keyof WandboxCompileResult,
): string {
  const value = result[field];
  if (value === undefined) return "";
  if (typeof value !== "string") {
    throw new CodeExecutionError(
      `Wandbox returned an incomplete execution result (${field}).`,
      502,
      "provider_invalid_response",
    );
  }
  return value;
}

function formatResult(
  compiler: string,
  result: WandboxCompileResult,
): CodeExecutionResult {
  const exitCode = exitCodeFrom(result.status);
  if (
    exitCode === null ||
    typeof result.status !== "string" ||
    (result.signal !== undefined && typeof result.signal !== "string")
  ) {
    throw new CodeExecutionError(
      "Wandbox returned an invalid execution status.",
      502,
      "provider_invalid_response",
    );
  }

  const compilerOutput = readOutputText(result, "compiler_output");
  const compilerError = readOutputText(result, "compiler_error");
  const compilerMessage =
    typeof result.compiler_message === "string"
      ? result.compiler_message
      : [compilerOutput, compilerError].filter(Boolean).join("\n");
  const stdout = truncateText(readOutputText(result, "program_output"));
  const stderr = truncateText(readOutputText(result, "program_error"));
  const compileOutput = truncateText(compilerMessage);
  if (
    (result.compiler_message !== undefined &&
      typeof result.compiler_message !== "string") ||
    (result.program_message !== undefined &&
      typeof result.program_message !== "string")
  ) {
    throw new CodeExecutionError(
      "Wandbox returned malformed output fields.",
      502,
      "provider_invalid_response",
    );
  }
  const message = truncateText(
    typeof result.program_message === "string" ? result.program_message : null,
  );
  const signal = truncateText(
    typeof result.signal === "string" && result.signal ? result.signal : null,
  );
  const hasCompilerDiagnostics = Boolean(compilerOutput || compilerError);
  const hasRuntimeOutput = Boolean(stdout.value || stderr.value);
  const status =
    exitCode === 0 && !signal.value
      ? "Accepted"
      : hasCompilerDiagnostics && !hasRuntimeOutput && !signal.value
        ? "Compilation Error"
        : "Runtime Error";

  return {
    compiler,
    status,
    stdout: stdout.value,
    stderr: stderr.value,
    compileOutput: compileOutput.value,
    message: message.value,
    time: null,
    memory: null,
    exitCode,
    exitSignal: signal.value,
    outputTruncated:
      stdout.truncated ||
      stderr.truncated ||
      compileOutput.truncated ||
      message.truncated ||
      signal.truncated,
  };
}

async function readJsonResponse(
  response: globalThis.Response,
  label: string,
): Promise<unknown> {
  if (response.status === 429) {
    throw new CodeExecutionError(
      "Wandbox is rate limiting requests. Please wait and try again.",
      429,
      "provider_rate_limited",
    );
  }
  if (response.status === 404) {
    throw new CodeExecutionError(
      "Wandbox could not find a supported compiler or API resource.",
      502,
      "provider_resource_not_found",
    );
  }
  if (!response.ok) {
    throw new CodeExecutionError(
      response.status >= 500
        ? "Wandbox is temporarily unavailable. Try again later."
        : `${label} was rejected by Wandbox (HTTP ${response.status}).`,
      response.status >= 500 ? 503 : 502,
      response.status >= 500 ? "provider_unavailable" : "provider_request_failed",
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new CodeExecutionError(
      `Wandbox returned an empty ${label} response.`,
      502,
      "provider_invalid_response",
    );
  }
  const chunks: Uint8Array[] = [];
  let responseBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      responseBytes += value.byteLength;
      if (responseBytes > MAX_PROVIDER_RESPONSE_BYTES) {
        await reader.cancel();
        throw new CodeExecutionError(
          "Wandbox returned an oversized response. Try a program with less output.",
          502,
          "provider_response_too_large",
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof CodeExecutionError) throw error;
    throw new CodeExecutionError(
      `Could not read the response from Wandbox ${label}.`,
      502,
      "provider_invalid_response",
    );
  }
  const bytes = new Uint8Array(responseBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CodeExecutionError(
      `Wandbox returned an invalid ${label} response.`,
      502,
      "provider_invalid_response",
    );
  }
}

async function providerFetch(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<globalThis.Response> {
  try {
    return await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new CodeExecutionError(
        "Wandbox took too long to respond. Try again.",
        504,
        "provider_timeout",
      );
    }
    throw new CodeExecutionError(
      "Could not reach Wandbox. The service may be unavailable.",
      503,
      "provider_unavailable",
    );
  }
}

export async function executeWithWandbox(
  input: CodeExecutionInput,
  options: CodeExecutionRouterOptions,
): Promise<CodeExecutionResult> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const compilerListResponse = await providerFetch(
    fetcher,
    `${WANDBOX_API}/list.json`,
    { method: "GET", headers: { Accept: "application/json" } },
    timeoutMs,
  );
  const compilerList = await readJsonResponse(
    compilerListResponse,
    "compiler list",
  );
  const compiler = resolveWandboxCompiler(input.language, compilerList);

  const compileResponse = await providerFetch(
    fetcher,
    `${WANDBOX_API}/compile.json`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        compiler,
        code: input.source,
        stdin: input.stdin,
        save: false,
      }),
    },
    timeoutMs,
  );
  const compileResult = await readJsonResponse(
    compileResponse,
    "compile request",
  );
  if (!isRecord(compileResult)) {
    throw new CodeExecutionError(
      "Wandbox returned an invalid execution result.",
      502,
      "provider_invalid_response",
    );
  }
  return formatResult(compiler, compileResult as WandboxCompileResult);
}

interface RequestWindow {
  startedAt: number;
  count: number;
}

function clientAddress(req: Request): string {
  return req.socket.remoteAddress ?? "unknown";
}

export function createCodeExecutionRouter(
  options: CodeExecutionRouterOptions,
): Router {
  const router = Router();
  const requestWindows = new Map<string, RequestWindow>();
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  router.post("/", async (req, res) => {
    const origin = req.get("origin");
    if (!origin || !options.allowedOrigins.has(origin)) {
      res.status(403).json({
        code: "origin_not_allowed",
        message: "Request origin is not allowed.",
      });
      return;
    }

    const validated = validateCodeExecutionInput(req.body);
    if (!validated.valid) {
      res.status(400).json({ code: "invalid_request", message: validated.message });
      return;
    }

    const address = clientAddress(req);
    const now = Date.now();
    for (const [key, requestWindow] of requestWindows) {
      if (now - requestWindow.startedAt >= windowMs) requestWindows.delete(key);
    }
    const requestWindow = requestWindows.get(address);
    if (requestWindow && now - requestWindow.startedAt < windowMs) {
      if (requestWindow.count >= maxRequests) {
        const retryAfterSeconds = Math.ceil(
          (windowMs - (now - requestWindow.startedAt)) / 1000,
        );
        res.setHeader("Retry-After", String(retryAfterSeconds));
        res.status(429).json({
          code: "local_rate_limited",
          message: "Too many code runs. Please wait before running another program.",
        });
        return;
      }
      requestWindow.count += 1;
    } else {
      requestWindows.set(address, { startedAt: now, count: 1 });
    }

    try {
      res.json(await executeWithWandbox(validated.value, options));
    } catch (error) {
      if (error instanceof CodeExecutionError) {
        res.status(error.httpStatus).json({
          code: error.code,
          message: error.message,
        });
        return;
      }
      console.error("Unexpected code execution service error.", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      res.status(500).json({
        code: "execution_failed",
        message: "The code execution request could not be completed.",
      });
    }
  });

  return router;
}
