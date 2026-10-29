export type CodeExecutionLanguage = "cpp" | "c" | "python" | "java";

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

export class CodeExecutionApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "CodeExecutionApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isExecutionResult(value: unknown): value is CodeExecutionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "compiler" in value &&
    typeof value.compiler === "string" &&
    value.compiler.length > 0 &&
    "status" in value &&
    typeof value.status === "string" &&
    value.status.length > 0 &&
    "stdout" in value &&
    isNullableString(value.stdout) &&
    "stderr" in value &&
    isNullableString(value.stderr) &&
    "compileOutput" in value &&
    isNullableString(value.compileOutput) &&
    "message" in value &&
    isNullableString(value.message) &&
    "time" in value &&
    isNullableString(value.time) &&
    "memory" in value &&
    isNullableNumber(value.memory) &&
    "exitCode" in value &&
    isNullableNumber(value.exitCode) &&
    "exitSignal" in value &&
    isNullableString(value.exitSignal) &&
    "outputTruncated" in value &&
    typeof value.outputTruncated === "boolean"
  );
}

function readRetryAfter(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? Math.ceil(seconds)
    : undefined;
}

async function readError(response: Response): Promise<CodeExecutionApiError> {
  try {
    const data: unknown = await response.json();
    if (
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof data.message === "string" &&
      "code" in data &&
      typeof data.code === "string"
    ) {
      return new CodeExecutionApiError(
        data.message,
        data.code,
        response.status,
        readRetryAfter(response),
      );
    }
  } catch {
    // Use a status-based message if the backend did not return JSON.
  }
  return new CodeExecutionApiError(
    `Code execution request failed with HTTP ${response.status}.`,
    "execution_request_failed",
    response.status,
    readRetryAfter(response),
  );
}

export async function executeCode(input: {
  language: CodeExecutionLanguage;
  source: string;
  stdin: string;
}): Promise<CodeExecutionResult> {
  let response: Response;
  try {
    response = await fetch("/api/code-execution", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CodeExecutionApiError(
      `Could not reach the AlgoCanvas code execution service: ${detail}`,
      "backend_unavailable",
      0,
    );
  }

  if (!response.ok) throw await readError(response);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new CodeExecutionApiError(
      "The execution service returned an unreadable response. Try again.",
      "invalid_execution_response",
      response.status,
    );
  }
  if (!isExecutionResult(data)) {
    throw new CodeExecutionApiError(
      "The execution service returned an incomplete response. Try again.",
      "invalid_execution_response",
      response.status,
    );
  }
  return data;
}
