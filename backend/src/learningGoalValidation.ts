export const MAX_LEARNING_GOAL_TOPICS = 12;
export const MAX_LEARNING_GOAL_DURATION_DAYS = 365;

export interface LearningGoalInput {
  targetTopics: number;
  durationDays: number;
}

export type LearningGoalValidation =
  | { valid: true; value: LearningGoalInput }
  | { valid: false; message: string };

export function validateLearningGoalInput(
  input: unknown,
): LearningGoalValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: false, message: "A valid learning goal is required." };
  }

  const { targetTopics, durationDays } = input as Record<string, unknown>;
  if (
    typeof targetTopics !== "number" ||
    !Number.isInteger(targetTopics) ||
    targetTopics < 1 ||
    targetTopics > MAX_LEARNING_GOAL_TOPICS
  ) {
    return {
      valid: false,
      message: `Choose between 1 and ${MAX_LEARNING_GOAL_TOPICS} target topics.`,
    };
  }
  if (
    typeof durationDays !== "number" ||
    !Number.isInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > MAX_LEARNING_GOAL_DURATION_DAYS
  ) {
    return {
      valid: false,
      message: `Choose a duration between 1 and ${MAX_LEARNING_GOAL_DURATION_DAYS} days.`,
    };
  }

  return {
    valid: true,
    value: { targetTopics, durationDays },
  };
}
