import assert from "node:assert/strict";
import test from "node:test";
import {
  createDownloadPayload,
  getLanguageFromFilename,
  getLanguageOption,
  languageOptions,
  MAX_UPLOAD_SIZE_BYTES,
  normalizeFilename,
  starterTemplates,
  validateUpload,
  type PlaygroundLanguage,
} from "../src/playground/files.ts";

test("the editor offers exactly the four requested languages and extensions", () => {
  assert.deepEqual(
    languageOptions.map(({ id, extension }) => [id, extension]),
    [
      ["cpp", ".cpp"],
      ["c", ".c"],
      ["python", ".py"],
      ["java", ".java"],
    ],
  );
  assert.equal(languageOptions.length, 4);
});

test("filename normalization keeps the selected language extension", () => {
  const cases: [PlaygroundLanguage, string, string][] = [
    ["cpp", "hello.py", "hello.cpp"],
    ["c", "program", "program.c"],
    ["python", "my script.java", "my script.py"],
    ["java", "Main.java", "Main.java"],
  ];
  for (const [language, input, expected] of cases) {
    assert.equal(normalizeFilename(input, language), expected);
    assert.equal(getLanguageOption(language).extension, expected.slice(expected.lastIndexOf(".")));
  }
  assert.equal(normalizeFilename("../bad:name?.c", "c"), "badname.c");
});

test("supported upload extensions are detected case-insensitively", () => {
  assert.equal(getLanguageFromFilename("sort.CPP"), "cpp");
  assert.equal(getLanguageFromFilename("main.c"), "c");
  assert.equal(getLanguageFromFilename("script.PY"), "python");
  assert.equal(getLanguageFromFilename("Main.Java"), "java");
  assert.equal(getLanguageFromFilename("notes.txt"), undefined);
});

test("upload validation enforces supported source files and a 1 MB size limit", () => {
  assert.deepEqual(validateUpload("main.cpp", 50), {
    valid: true,
    language: "cpp",
  });
  assert.equal(validateUpload("archive.zip", 10).valid, false);
  assert.match(validateUpload("archive.zip", 10).message ?? "", /\.cpp/);
  assert.equal(
    validateUpload("large.py", MAX_UPLOAD_SIZE_BYTES + 1).valid,
    false,
  );
  assert.equal(validateUpload("limit.c", MAX_UPLOAD_SIZE_BYTES).valid, true);
  assert.equal(validateUpload("negative.java", -1).valid, false);
  assert.match(
    validateUpload("large.py", MAX_UPLOAD_SIZE_BYTES + 1).message ?? "",
    /1 MB/,
  );
});

test("browser download payload uses the correct local filename and source", () => {
  assert.deepEqual(
    createDownloadPayload("answer.txt", "print(42)\n", "python"),
    {
      filename: "answer.py",
      content: "print(42)\n",
      mimeType: "text/plain;charset=utf-8",
    },
  );
});

test("optional starter templates are available for each supported language", () => {
  assert.deepEqual(
    [...new Set(starterTemplates.map((template) => template.language))].sort(),
    ["c", "cpp", "java", "python"],
  );
  for (const language of languageOptions) {
    assert.ok(starterTemplates.some((template) => template.language === language.id));
  }
});

test("download payload preserves the source text without transforming it", () => {
  assert.equal(
    createDownloadPayload("Main.java", "class Main {}", "java").content,
    "class Main {}",
  );
});
