import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  deleteLearningGoal,
  getLearningGoal,
  saveLearningGoal,
  type LearningGoal,
} from "../api/client";
import { calculateGoalProgress } from "../learning/goalProgress";

interface LearningGoalPanelProps {
  completedTopics: number;
  maximumTopics: number;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not update your goal.";
}

function LearningGoalPanel({
  completedTopics,
  maximumTopics,
}: LearningGoalPanelProps) {
  const [goal, setGoal] = useState<LearningGoal | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [isEditing, setIsEditing] = useState(false);
  const [targetTopics, setTargetTopics] = useState("5");
  const [durationDays, setDurationDays] = useState("14");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const applyGoal = useCallback((savedGoal: LearningGoal | null) => {
    setGoal(savedGoal);
    if (savedGoal) {
      setTargetTopics(String(savedGoal.targetTopics));
      setDurationDays(String(savedGoal.durationDays));
    }
    setState("ready");
  }, []);

  const loadGoal = useCallback(async () => {
    setState("loading");
    setError(undefined);
    try {
      const savedGoal = await getLearningGoal();
      applyGoal(savedGoal);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setState("error");
    }
  }, [applyGoal]);

  useEffect(() => {
    let isMounted = true;
    void getLearningGoal()
      .then((savedGoal) => {
        if (isMounted) applyGoal(savedGoal);
      })
      .catch((loadError: unknown) => {
        if (!isMounted) return;
        setError(getErrorMessage(loadError));
        setState("error");
      });
    return () => {
      isMounted = false;
    };
  }, [applyGoal]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setNotice(undefined);

    const target = Number(targetTopics);
    const days = Number(durationDays);
    if (!Number.isInteger(target) || target < 1 || target > maximumTopics) {
      setError(`Choose between 1 and ${maximumTopics} topics.`);
      return;
    }
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      setError("Choose a duration between 1 and 365 days.");
      return;
    }

    setIsSaving(true);
    try {
      const savedGoal = await saveLearningGoal({
        targetTopics: target,
        durationDays: days,
      });
      setGoal(savedGoal);
      setIsEditing(false);
      setNotice("Your learning goal was saved.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setError(undefined);
    setNotice(undefined);
    setIsDeleting(true);
    try {
      await deleteLearningGoal();
      setGoal(null);
      setTargetTopics("5");
      setDurationDays("14");
      setIsEditing(false);
      setNotice("Your learning goal was deleted.");
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsDeleting(false);
    }
  }

  function startEditing() {
    if (goal) {
      setTargetTopics(String(goal.targetTopics));
      setDurationDays(String(goal.durationDays));
    }
    setError(undefined);
    setNotice(undefined);
    setIsEditing(true);
  }

  const progress = goal
    ? calculateGoalProgress(
        completedTopics,
        goal.targetTopics,
        goal.deadlineAt,
      )
    : undefined;

  const goalProgressMessage = progress
    ? progress.isComplete
      ? "Target reached — you’ve finished your weekly learning goal."
      : progress.remainingDays === 0
        ? "Deadline reached — finish one more topic to hit your target."
        : `${progress.remainingTopics} ${progress.remainingTopics === 1 ? "topic" : "topics"} left to reach your goal.`
    : "";

  return (
    <section className="learn-panel learning-goal-panel" aria-labelledby="learning-goal-title">
      <div className="learn-panel-heading">
        <div>
          <div className="eyebrow">YOUR PERSONAL TARGET</div>
          <h3 id="learning-goal-title">Learning goal</h3>
        </div>
        {goal && state === "ready" && !isEditing && (
          <div className="learning-goal-actions">
            <button type="button" onClick={startEditing}>Edit goal</button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting || isSaving}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {state === "loading" ? (
        <div className="learning-goal-state" aria-live="polite">
          <span className="loading-spinner" />
          <span>Loading your learning goal…</span>
        </div>
      ) : state === "error" ? (
        <div className="learning-goal-state learning-goal-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => void loadGoal()}>Try again</button>
        </div>
      ) : (
        <>
          {goal && progress ? (
            <div className="learning-goal-summary">
              <div className="learning-goal-count">
                <strong>{progress.completedTopics}</strong>
                <span>completed of {goal.targetTopics} target topics</span>
              </div>
              <div
                className="learning-goal-track"
                role="progressbar"
                aria-label="Learning goal progress"
                aria-valuemin={0}
                aria-valuemax={goal.targetTopics}
                aria-valuenow={Math.min(progress.completedTopics, goal.targetTopics)}
                aria-valuetext={`${progress.percentage}% complete, ${progress.remainingTopics} topics remaining`}
              >
                <span style={{ width: `${progress.percentage}%` }} />
              </div>
              <div className="learning-goal-meta">
                <span>
                  {progress.isComplete
                    ? "Goal achieved"
                    : progress.remainingDays === 0
                      ? "Deadline reached"
                      : `${progress.remainingDays} ${progress.remainingDays === 1 ? "day" : "days"} remaining`}
                </span>
                <span>{progress.percentage}% of goal</span>
              </div>
              <div className="learning-goal-meta">
                <span>{progress.remainingTopics} {progress.remainingTopics === 1 ? "topic" : "topics"} remaining</span>
                <span>Started {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(goal.startedAt))}</span>
              </div>
              {goalProgressMessage && (
                <div className="learning-goal-message success" role="status">
                  {goalProgressMessage}
                </div>
              )}
            </div>
          ) : (
            <p className="learning-goal-empty">
              Set a target for how many topics you want to complete and by when.
              Your progress updates from the topics you complete in AlgoCanvas.
            </p>
          )}

          {isEditing || !goal ? (
            <form className="learning-goal-form" onSubmit={(event) => void handleSave(event)}>
              <label>
                Topics to complete
                <input
                  type="number"
                  min={1}
                  max={maximumTopics}
                  step={1}
                  value={targetTopics}
                  onChange={(event) => setTargetTopics(event.target.value)}
                  required
                />
              </label>
              <label>
                Within how many days?
                <input
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={durationDays}
                  onChange={(event) => setDurationDays(event.target.value)}
                  required
                />
              </label>
              <p className="learning-goal-form-note">
                Updating a goal starts a new time window.
              </p>
              <div className="learning-goal-form-actions">
                <button className="primary-button" type="submit" disabled={isSaving || isDeleting}>
                  {isSaving ? "Saving…" : goal ? "Update goal" : "Set goal"}
                </button>
                {goal && (
                  <button
                    className="learning-goal-cancel"
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setError(undefined);
                    }}
                    disabled={isSaving || isDeleting}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          ) : null}
        </>
      )}

      {error && state === "ready" && (
        <p className="learning-goal-message error" role="alert">{error}</p>
      )}
      {notice && <p className="learning-goal-message success" role="status">{notice}</p>}
    </section>
  );
}

export default LearningGoalPanel;
