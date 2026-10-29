import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { basicSetup, EditorView } from "codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { keymap, placeholder } from "@codemirror/view";
import {
  CodeExecutionApiError,
  executeCode,
  type CodeExecutionResult,
} from "../api/codeExecution";
import {
  editorEditabilityEffect,
  editorEditableExtension,
} from "../playground/editorEditability";
import {
  createDownloadPayload,
  getLanguageOption,
  languageOptions,
  MAX_UPLOAD_SIZE_BYTES,
  normalizeFilename,
  starterTemplates,
  validateUpload,
  type PlaygroundLanguage,
} from "../playground/files";
import "./CodePlayground.css";

type LanguageDrafts = Record<PlaygroundLanguage, string>;

const emptyDrafts: LanguageDrafts = {
  cpp: "",
  c: "",
  python: "",
  java: "",
};

interface CodeEditorProps {
  language: PlaygroundLanguage;
  value: string;
  readOnly: boolean;
  editorFontSize: number;
  onChange: (value: string) => void;
  onRunShortcut: () => void;
  onSaveShortcut: () => void;
}

function CodeEditor({
  language,
  value,
  readOnly,
  editorFontSize,
  onChange,
  onRunShortcut,
  onSaveShortcut,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunShortcutRef = useRef(onRunShortcut);
  const onSaveShortcutRef = useRef(onSaveShortcut);
  const readOnlyRef = useRef(readOnly);
  const [editorReady, setEditorReady] = useState(false);
  const [editorError, setEditorError] = useState("");

  useEffect(() => {
    onChangeRef.current = onChange;
    onRunShortcutRef.current = onRunShortcut;
    onSaveShortcutRef.current = onSaveShortcut;
    readOnlyRef.current = readOnly;
  }, [onChange, onRunShortcut, onSaveShortcut, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({ effects: editorEditabilityEffect(readOnly) });
    view.contentDOM.setAttribute("aria-readonly", String(readOnly));
  }, [readOnly]);

  useEffect(() => {
    let active = true;
    const loadLanguage =
      language === "python"
        ? import("@codemirror/lang-python").then(({ python }) => python())
        : language === "java"
          ? import("@codemirror/lang-java").then(({ java }) => java())
          : import("@codemirror/lang-cpp").then(({ cpp }) => cpp());

    void loadLanguage
      .then((languageSupport) => {
        if (!active || !hostRef.current) return;
        const view = new EditorView({
          doc: "",
          extensions: [
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => {
                  onRunShortcutRef.current();
                  return true;
                },
              },
              {
                key: "Mod-s",
                run: () => {
                  onSaveShortcutRef.current();
                  return true;
                },
              },
            ]),
            basicSetup,
            editorEditableExtension(readOnlyRef.current),
            languageSupport,
            oneDark,
            placeholder("Start typing your code here…"),
            EditorView.theme({
              "&": { height: "100%", backgroundColor: "#11151e", color: "#e7eaf2" },
              ".cm-scroller": {
                overflow: "auto",
                fontFamily: "var(--mono)",
                fontSize: `${editorFontSize}px`,
              },
              ".cm-gutters": {
                backgroundColor: "#11151e",
                color: "#778197",
                border: "none",
              },
              ".cm-activeLineGutter": { backgroundColor: "#202637" },
              ".cm-activeLine": { backgroundColor: "#ffffff08" },
              ".cm-placeholder": { color: "#687287" },
            }),
            EditorView.contentAttributes.of({ "aria-label": "Code editor" }),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString());
              }
            }),
          ],
          parent: hostRef.current,
        });
        viewRef.current = view;
        setEditorReady(true);
      })
      .catch(() => {
        if (active) {
          setEditorError("The editor language tools could not be loaded. Refresh and try again.");
        }
      });

    return () => {
      active = false;
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [editorFontSize, language]);

  useEffect(() => {
    const view = viewRef.current;
    if (!editorReady || !view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [editorReady, language, value]);

  return (
    <div className="code-editor" ref={hostRef}>
      {editorError && <p className="playground-editor-error" role="alert">{editorError}</p>}
    </div>
  );
}

interface CodePlaygroundProps {
  preferredLanguage?: PlaygroundLanguage;
  editorFontSize?: number;
}

function CodePlayground({
  preferredLanguage = "cpp",
  editorFontSize = 13,
}: CodePlaygroundProps) {
  const [language, setLanguage] = useState<PlaygroundLanguage>(preferredLanguage);
  const [filename, setFilename] = useState(
    `main${getLanguageOption(preferredLanguage).extension}`,
  );
  const [source, setSource] = useState("");
  const [savedDrafts, setSavedDrafts] = useState<LanguageDrafts>(emptyDrafts);
  const [drafts, setDrafts] = useState<LanguageDrafts>(emptyDrafts);
  const [uploadError, setUploadError] = useState("");
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [terminalCleared, setTerminalCleared] = useState(false);
  const [stdin, setStdin] = useState("");
  const [executionResult, setExecutionResult] =
    useState<CodeExecutionResult | null>(null);
  const [executionError, setExecutionError] = useState("");
  const [executionState, setExecutionState] = useState<
    "idle" | "running" | "success" | "finished" | "error"
  >("idle");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number | null>(
    null,
  );
  const uploadRef = useRef<HTMLInputElement>(null);
  const languageOption = getLanguageOption(language);
  const isDirty = source !== savedDrafts[language];
  const isExecuting = executionState === "running";

  function resetExecutionOutput() {
    setExecutionResult(null);
    setExecutionError("");
    setRetryAfterSeconds(null);
    setExecutionState("idle");
    setTerminalCleared(false);
  }

  async function runCode() {
    if (isExecuting) return;
    if (!source.trim()) {
      setExecutionResult(null);
      setExecutionError("Add some source code before running.");
      setExecutionState("error");
      setTerminalCleared(false);
      return;
    }

    setTerminalCleared(false);
    setExecutionResult(null);
    setExecutionError("");
    setRetryAfterSeconds(null);
    setAnnouncement("");
    setExecutionState("running");
    const input = { language, source, stdin };
    try {
      const result = await executeCode(input);
      setExecutionResult(result);
      setExecutionState(result.status === "Accepted" ? "success" : "finished");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The code execution request could not be completed.";
      setExecutionError(message);
      setRetryAfterSeconds(
        error instanceof CodeExecutionApiError
          ? error.retryAfterSeconds ?? null
          : null,
      );
      setExecutionState("error");
    }
  }

  function clearOutput() {
    setAnnouncement("");
    setTerminalCleared(true);
    setExecutionResult(null);
    setExecutionError("");
    setRetryAfterSeconds(null);
    setExecutionState("idle");
  }

  function outputText(value: string | null, emptyText: string): string {
    return value ?? emptyText;
  }

  function getExecutionStatusLabel(): string {
    if (executionState === "running") return "Running…";
    if (executionState === "error") return "Request failed";
    if (executionResult) return executionResult.status;
    if (terminalCleared) return "Cleared";
    return "Ready";
  }

  function getExecutionStatusClass(): string {
    return executionState === "running"
      ? "running"
      : executionState === "success"
        ? "success"
        : executionState === "finished" || executionState === "error"
          ? "failed"
          : "idle";
  }

  function downloadFile() {
    const payload = createDownloadPayload(filename, source, language);
    const url = URL.createObjectURL(
      new Blob([payload.content], { type: payload.mimeType }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = payload.filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSavedDrafts((current) => ({ ...current, [language]: source }));
    setAnnouncement(
      `${payload.filename} downloaded to your device by the browser. No cloud copy was created.`,
    );
  }

  function changeLanguage(nextLanguage: PlaygroundLanguage) {
    if (nextLanguage === language) return;
    resetExecutionOutput();
    setDrafts((current) => ({ ...current, [language]: source }));
    setLanguage(nextLanguage);
    setSource(drafts[nextLanguage]);
    setTerminalCleared(false);
    setFilename((current) => normalizeFilename(current, nextLanguage));
    setUploadError("");
    setAnnouncement("");
  }

  function selectTemplate(templateId: string) {
    if (!templateId) return;
    const template = starterTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (isDirty && !window.confirm("Replace your current code with this template?")) {
      return;
    }
    resetExecutionOutput();
    setDrafts((current) => ({ ...current, [language]: source }));
    setLanguage(template.language);
    setFilename((current) =>
      normalizeFilename(current, template.language),
    );
    setSource(template.source);
    setSavedDrafts((current) => ({
      ...current,
      [template.language]: "",
    }));
    setDrafts((current) => ({
      ...current,
      [template.language]: template.source,
    }));
    setUploadError("");
    setAnnouncement(`${template.name} template loaded. It has not been run.`);
  }

  function createNewFile() {
    if (isDirty && !window.confirm("Discard your unsaved changes and create a blank file?")) {
      return;
    }
    resetExecutionOutput();
    setSource("");
    setSavedDrafts((current) => ({ ...current, [language]: "" }));
    setDrafts((current) => ({ ...current, [language]: "" }));
    setFilename(`main${languageOption.extension}`);
    setUploadError("");
    setAnnouncement("Created a blank file. Download it to save a local copy.");
  }

  async function uploadFile(file: File) {
    const validation = validateUpload(file.name, file.size);
    if (!validation.valid || !validation.language) {
      setUploadError(validation.message ?? "This file cannot be opened.");
      return;
    }
    const uploadedLanguage = validation.language;
    if (isDirty && !window.confirm("Replace your unsaved editor content with this file?")) {
      return;
    }
    try {
      const contents = await file.text();
      resetExecutionOutput();
      setLanguage(uploadedLanguage);
      setFilename(normalizeFilename(file.name, uploadedLanguage));
      setSource(contents);
      setSavedDrafts((current) => ({
        ...current,
        [uploadedLanguage]: contents,
      }));
      setDrafts((current) => ({
        ...current,
        [uploadedLanguage]: contents,
      }));
      setTerminalCleared(false);
      setUploadError("");
      setAnnouncement(
        `${file.name} opened locally. It was not executed or uploaded.`,
      );
    } catch {
      setUploadError("The selected file could not be read. Try another source file.");
    }
  }

  function updateFilename(value: string) {
    setFilename(value);
  }

  function normalizeEditedFilename() {
    setFilename((current) => normalizeFilename(current, language));
  }

  function handleSourceChange(value: string) {
    resetExecutionOutput();
    setSource(value);
    setDrafts((current) => ({ ...current, [language]: value }));
    setAnnouncement("");
  }

  function handleUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) void uploadFile(file);
  }

  return (
    <section className="playground" aria-label="Interactive code playground">
      <div className="playground-intro">
        <div>
          <div className="eyebrow">YOUR LOCAL MINI IDE</div>
          <h2>Start with a blank file</h2>
          <p>
            Write and edit code here. Files stay in this browser until you choose
            to download them.
          </p>
        </div>
        <span className="playground-local-badge">
          <span className="status-dot" /> WANDOX SANDBOX · NO API KEY
        </span>
      </div>

      <div className="playground-toolbar">
        <label className="playground-select">
          <span>Language</span>
          <select
            aria-label="Programming language"
            value={language}
            disabled={isExecuting}
            onChange={(event) =>
              changeLanguage(event.target.value as PlaygroundLanguage)
            }
          >
            {languageOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="playground-select playground-filename">
          <span>File name</span>
          <input
            aria-label="File name"
            value={filename}
            disabled={isExecuting}
            onChange={(event) => updateFilename(event.target.value)}
            onBlur={normalizeEditedFilename}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        <div className="playground-actions">
          <label className="playground-template-select">
            <span className="visually-hidden">Optional starter template</span>
            <select
              aria-label="Optional starter template"
              value=""
              disabled={isExecuting}
              onChange={(event) => selectTemplate(event.target.value)}
            >
              <option value="">Starter templates…</option>
              {languageOptions.map((option) => (
                <optgroup key={option.id} label={option.label}>
                  {starterTemplates
                    .filter((template) => template.language === option.id)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button type="button" onClick={createNewFile} disabled={isExecuting}>
            New file
          </button>
          <button type="button" onClick={downloadFile} disabled={isExecuting}>
            Download
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            disabled={isExecuting}
          >
            Upload
          </button>
          <input
            ref={uploadRef}
            className="playground-file-input"
            type="file"
            accept=".cpp,.c,.py,.java"
            disabled={isExecuting}
            onChange={handleUploadChange}
            aria-label="Upload a source file"
          />
        </div>
      </div>

      {uploadError && (
        <p className="playground-upload-error" role="alert">
          {uploadError}
        </p>
      )}

      <div className="playground-editor-panel" aria-label="Code">
        <div className="playground-panel-header">
          <div>
            <span className="playground-file-dot" />
            <strong>{filename || `main${languageOption.extension}`}</strong>
            <span className="playground-language-label">{languageOption.label}</span>
            {isDirty && <span className="playground-unsaved">Unsaved</span>}
          </div>
          <span>LOCAL FILE · NOT UPLOADED</span>
        </div>
        <CodeEditor
          key={language}
          language={language}
          value={source}
          readOnly={isExecuting}
          editorFontSize={editorFontSize}
          onChange={handleSourceChange}
          onRunShortcut={runCode}
          onSaveShortcut={downloadFile}
        />
      </div>

      <div className="playground-execution-toolbar">
        <div className="playground-run-actions">
          <button
            className="playground-run"
            type="button"
            disabled={isExecuting || !source.trim()}
            onClick={() => void runCode()}
            title={
              source.trim()
                ? "Send this source and standard input to Wandbox through the AlgoCanvas backend."
                : "Add source code before running."
            }
          >
            {isExecuting ? "Running…" : "▶ Run"}
          </button>
          <button
            type="button"
            disabled
            title="The configured hosted service does not provide cancellation for an active submission."
          >
            Stop
          </button>
          <span>Ctrl+Enter · Ctrl+S to download</span>
        </div>
        <span className="playground-runtime-label">
          {languageOption.label} · {languageOption.extension}
        </span>
      </div>

      {announcement && (
        <p className="playground-announcement" role="status">
          {announcement}
        </p>
      )}

      <section className="playground-output-panel" aria-label="Output and terminal">
        <div className="playground-output-header">
          <div>
            <span className="playground-output-indicator" />
            <strong>Terminal</strong>
              <span
                className={`playground-status ${getExecutionStatusClass()}`}
                role="status"
                aria-live="polite"
              >
                {getExecutionStatusLabel()}
              </span>
          </div>
          <div className="playground-output-controls">
            <button
              type="button"
              disabled={isExecuting}
              onClick={clearOutput}
            >
              Clear output
            </button>
            <button
              type="button"
              aria-expanded={!isOutputCollapsed}
              onClick={() => setIsOutputCollapsed((collapsed) => !collapsed)}
            >
              {isOutputCollapsed ? "Expand" : "Collapse"}
            </button>
          </div>
        </div>
        {!isOutputCollapsed && (
          <div className="playground-terminal-content">
            {terminalCleared ? (
              <p className="playground-terminal-empty">Terminal cleared.</p>
            ) : executionState === "running" ? (
              <p className="playground-terminal-empty">
                Discovering a compiler and waiting for the Wandbox sandbox…
              </p>
            ) : executionError ? (
              <div className="playground-execution-error" role="alert">
                <strong>Execution could not be completed</strong>
                <p>{executionError}</p>
                {retryAfterSeconds !== null && (
                  <p>Try again in about {retryAfterSeconds} seconds.</p>
                )}
              </div>
            ) : executionResult ? (
              <>
                <div className="playground-stream">
                  <strong>stdout</strong>
                  <pre>
                    {outputText(executionResult.stdout, "No stdout returned.")}
                  </pre>
                </div>
                <div className="playground-stream">
                  <strong>stderr</strong>
                  <pre>
                    {outputText(executionResult.stderr, "No stderr returned.")}
                  </pre>
                </div>
                <div className="playground-stream playground-diagnostics">
                  <strong>Compilation diagnostics</strong>
                  <pre>
                    {outputText(
                      executionResult.compileOutput,
                      "No compiler diagnostics returned.",
                    )}
                  </pre>
                </div>
                <div className="playground-stream playground-diagnostics">
                  <strong>Runtime diagnostics</strong>
                  <pre>
                    {outputText(
                      executionResult.message,
                      "No runtime message returned.",
                    )}
                  </pre>
                </div>
                <div className="playground-stream playground-diagnostics">
                  <strong>Execution status</strong>
                  <pre>
                    {[
                      `Compiler: ${executionResult.compiler}`,
                      `Status: ${executionResult.status}`,
                      executionResult.exitCode !== null
                        ? `Exit code: ${executionResult.exitCode}`
                        : null,
                      executionResult.exitSignal !== null
                        ? `Exit signal: ${executionResult.exitSignal}`
                        : null,
                      executionResult.time !== null
                        ? `CPU time: ${executionResult.time} s`
                        : null,
                      executionResult.memory !== null
                        ? `Memory: ${executionResult.memory} KB`
                        : null,
                    ]
                      .filter((line): line is string => line !== null)
                      .join("\n")}
                  </pre>
                </div>
                {executionResult.outputTruncated && (
                  <p className="playground-output-truncated" role="status">
                    Output was shortened to fit the terminal.
                  </p>
                )}
              </>
            ) : (
              <p className="playground-terminal-empty">
                Run your code to see the actual output and compiler diagnostics.
              </p>
            )}
            <label className="playground-stdin">
              <span>Standard input</span>
              <textarea
                aria-label="Standard input"
                placeholder="Optional input passed to your program"
                maxLength={8 * 1024}
                value={stdin}
                disabled={isExecuting}
                onChange={(event) => setStdin(event.target.value)}
              />
            </label>
          </div>
        )}
        <p className="playground-safety-note">
          Clicking Run sends the current source and input to Wandbox through the
          AlgoCanvas backend for execution; AlgoCanvas does not save them. Review
          Wandbox&apos;s privacy terms before running private code. Uploads alone
          never execute or upload files.
        </p>
      </section>
      <p className="playground-shortcut-note">
        Current language: {languageOption.label}. Upload limit:{" "}
        {MAX_UPLOAD_SIZE_BYTES / 1024 / 1024} MB. Uploaded files are never run
        automatically.
      </p>
    </section>
  );
}

export default CodePlayground;
