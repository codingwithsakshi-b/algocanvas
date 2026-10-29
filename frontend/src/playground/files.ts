export type PlaygroundLanguage = "cpp" | "c" | "python" | "java";

export interface LanguageOption {
  id: PlaygroundLanguage;
  label: string;
  extension: string;
}

export interface StarterTemplate {
  id: string;
  name: string;
  language: PlaygroundLanguage;
  source: string;
}

export interface UploadValidation {
  valid: boolean;
  language?: PlaygroundLanguage;
  message?: string;
}

export interface DownloadPayload {
  filename: string;
  content: string;
  mimeType: string;
}

export const MAX_UPLOAD_SIZE_BYTES = 1024 * 1024;

export const languageOptions: LanguageOption[] = [
  { id: "cpp", label: "C++", extension: ".cpp" },
  { id: "c", label: "C", extension: ".c" },
  { id: "python", label: "Python", extension: ".py" },
  { id: "java", label: "Java", extension: ".java" },
];

export const starterTemplates: StarterTemplate[] = [
  {
    id: "cpp-hello",
    name: "Hello world",
    language: "cpp",
    source: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, world!" << endl;
    return 0;
}`,
  },
  {
    id: "c-hello",
    name: "Hello world",
    language: "c",
    source: `#include <stdio.h>

int main(void) {
    printf("Hello, world!\\n");
    return 0;
}`,
  },
  {
    id: "python-hello",
    name: "Hello world",
    language: "python",
    source: `def main():
    print("Hello, world!")


if __name__ == "__main__":
    main()`,
  },
  {
    id: "java-hello",
    name: "Hello world",
    language: "java",
    source: `class Main {
    public static void main(String[] args) {
        System.out.println("Hello, world!");
    }
}`,
  },
];

export function getLanguageOption(
  language: PlaygroundLanguage,
): LanguageOption {
  return languageOptions.find((option) => option.id === language)!;
}

export function getLanguageFromFilename(
  filename: string,
): PlaygroundLanguage | undefined {
  const extension = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return languageOptions.find((option) => option.extension === extension)?.id;
}

export function normalizeFilename(
  filename: string,
  language: PlaygroundLanguage,
): string {
  const trimmed = filename.trim();
  const basename = trimmed.replace(/\.[^.]+$/, "");
  const safeBasename = basename
    .replace(/[<>:"/\\|?*]/g, "")
    .split("")
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 120);
  return `${safeBasename || "main"}${getLanguageOption(language).extension}`;
}

export function validateUpload(
  filename: string,
  size: number,
): UploadValidation {
  const language = getLanguageFromFilename(filename);
  if (!language) {
    return {
      valid: false,
      message: "Choose a .cpp, .c, .py, or .java source file.",
    };
  }
  if (size < 0 || size > MAX_UPLOAD_SIZE_BYTES) {
    return {
      valid: false,
      message: "Files must be 1 MB or smaller.",
    };
  }
  return { valid: true, language };
}

export function createDownloadPayload(
  filename: string,
  source: string,
  language: PlaygroundLanguage,
): DownloadPayload {
  return {
    filename: normalizeFilename(filename, language),
    content: source,
    mimeType: "text/plain;charset=utf-8",
  };
}
