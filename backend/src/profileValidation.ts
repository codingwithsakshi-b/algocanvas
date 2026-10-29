export const profileLanguages = ["cpp", "c", "python", "java"] as const;
export const learningLevels = ["beginner", "intermediate", "advanced"] as const;

export interface ProfileUpdate {
  name: string;
  username: string;
  displayName: string;
  bio: string;
  preferredLanguage: (typeof profileLanguages)[number];
  learningLevel: (typeof learningLevels)[number];
  editorFontSize: number;
}

export function validateProfileUpdate(
  value: unknown,
): { update: ProfileUpdate } | { error: string } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { error: "A valid profile payload is required." };
  }
  const body = value as Record<string, unknown>;
  const allowedFields = new Set([
    "name",
    "username",
    "displayName",
    "bio",
    "preferredLanguage",
    "learningLevel",
    "editorFontSize",
  ]);
  if (Object.keys(body).some((key) => !allowedFields.has(key))) {
    return { error: "The profile contains unsupported fields." };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";
  if (name.length < 1 || name.length > 80) {
    return { error: "Full name must be between 1 and 80 characters." };
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      error: "Username must be 3–24 characters using lowercase letters, numbers, or underscores.",
    };
  }
  if (displayName.length > 60) {
    return { error: "Display name must be 60 characters or fewer." };
  }
  if (bio.length > 280) {
    return { error: "Bio must be 280 characters or fewer." };
  }
  if (
    typeof body.preferredLanguage !== "string" ||
    !profileLanguages.includes(body.preferredLanguage as (typeof profileLanguages)[number])
  ) {
    return { error: "Preferred programming language is invalid." };
  }
  if (
    typeof body.learningLevel !== "string" ||
    !learningLevels.includes(body.learningLevel as (typeof learningLevels)[number])
  ) {
    return { error: "Learning level is invalid." };
  }
  if (
    typeof body.editorFontSize !== "number" ||
    !Number.isInteger(body.editorFontSize) ||
    body.editorFontSize < 10 ||
    body.editorFontSize > 24
  ) {
    return { error: "Editor font size must be an integer from 10 to 24." };
  }

  return {
    update: {
      name,
      username,
      displayName,
      bio,
      preferredLanguage: body.preferredLanguage as ProfileUpdate["preferredLanguage"],
      learningLevel: body.learningLevel as ProfileUpdate["learningLevel"],
      editorFontSize: body.editorFontSize,
    },
  };
}
