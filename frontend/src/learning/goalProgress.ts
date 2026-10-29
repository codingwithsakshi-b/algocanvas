export interface GoalProgress {
  completedTopics: number;
  remainingTopics: number;
  percentage: number;
  remainingDays: number;
  isComplete: boolean;
}

export function calculateGoalProgress(
  completedTopics: number,
  targetTopics: number,
  deadlineAt: string,
  now = new Date(),
): GoalProgress {
  const completed = Math.max(0, completedTopics);
  const target = Math.max(1, targetTopics);
  const remainingMilliseconds = new Date(deadlineAt).getTime() - now.getTime();
  const remainingTopics = Math.max(0, target - completed);

  return {
    completedTopics: completed,
    remainingTopics,
    percentage: Math.min(100, Math.round((completed / target) * 100)),
    remainingDays: Number.isFinite(remainingMilliseconds)
      ? Math.max(0, Math.ceil(remainingMilliseconds / (24 * 60 * 60 * 1000)))
      : 0,
    isComplete: completed >= target,
  };
}
