
import { useCallback, useEffect, useMemo, useState } from "react";
import { typeScriptSortingEngine } from "./algorithms/typescriptSortingEngine";
import type { SortingAlgorithm } from "./algorithms/types";
import { replaySortingEvents } from "./visualization/replaySortingEvents";
import { getSortingStepDetails } from "./visualization/sortingStepDetails";
import ArraysVisualizer from "./components/ArraysVisualizer";
import LinkedListVisualizer from "./components/LinkedListVisualizer";
import StacksQueuesVisualizer from "./components/StacksQueuesVisualizer";
import TreesVisualizer from "./components/TreesVisualizer";
import GraphExplorer from "./components/GraphExplorer";
import GoogleSignInButton from "./components/GoogleSignInButton";
import LearningGoalPanel from "./components/LearningGoalPanel";
import CodePlayground from "./components/CodePlayground";
import AccountPage from "./components/AccountPage";
import {
  getLearningProgress,
  getCurrentUser,
  saveLearningProgress,
  signInWithGoogle,
  signOut,
  type AuthUser,
  type LearningProgressRecord,
  type LearningProgressStatus,
} from "./api/client";
import {
  graphAlgorithmForTopic,
  learningTopics,
  type LearningTopic,
} from "./learning/topics";
import {
  hashForRoute,
  resolveAppRoute,
  resolveStartupRoute,
  type AppPage,
  type AppRoute,
  type WorkspaceSection,
} from "./navigation";
import "./App.css";

const initialValues = [42, 72, 34, 88, 56, 24, 65, 48, 92, 38, 61, 29];
type Page = AppPage;

interface AccountMenuProps {
  user: AuthUser;
  isBusy: boolean;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

function AccountMenu({ user, isBusy, onNavigate, onLogout }: AccountMenuProps) {
  const accountName = user.displayName || user.name;
  return (
    <details className="profile-menu">
      <summary aria-label="Open profile and account settings">
        {user.avatar ? (
          <img className="avatar avatar-image" src={user.avatar} alt="" />
        ) : (
          <span className="avatar" aria-hidden="true">
            {accountName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="profile-menu-name">{accountName}</span>
        <span className="profile-menu-chevron">⌄</span>
      </summary>
      <div className="profile-menu-dropdown">
        <strong>{accountName}</strong>
        <span>{user.username ? `@${user.username}` : "Set your username"}</span>
        <span>{user.email}</span>
        <button type="button" onClick={() => onNavigate("profile")}>View profile</button>
        <button type="button" onClick={() => onNavigate("settings")}>Account settings</button>
        <button className="topbar-signout" type="button" onClick={onLogout} disabled={isBusy}>
          Sign out
        </button>
      </div>
    </details>
  );
}

interface NavigationSidebarProps {
  activeSection: WorkspaceSection;
  page: Page;
  onHome: () => void;
  onLearn: () => void;
  onPlayground: () => void;
  onOpenWorkspace: (section: WorkspaceSection) => void;
}

function NavigationSidebar({
  activeSection,
  page,
  onHome,
  onLearn,
  onPlayground,
  onOpenWorkspace,
}: NavigationSidebarProps) {
  const navItems: {
    label: string;
    icon: string;
    section: WorkspaceSection;
  }[] = [
    { label: "Sorting Lab", icon: "▥", section: "sorting" },
    { label: "Data Structures", icon: "▤", section: "structures" },
    { label: "Graph Explorer", icon: "⌘", section: "graphs" },
  ];

  return (
    <aside className="sidebar">
      <a className="brand" href="#home" aria-label="AlgoCanvas home" onClick={(event) => {
        event.preventDefault();
        onHome();
      }}>
        <img className="brand-logo" src="/logo.png" alt="AlgoCanvas" />
      </a>
      <div className="nav-label">WORKSPACE</div>
      <nav className="navigation" aria-label="Main navigation">
        {navItems.map(({ label, icon, section }) => (
          <a
            key={section}
            className={`nav-item${page === "workspace" && activeSection === section ? " active" : ""}`}
            href={`#${section}`}
            aria-current={
              page === "workspace" && activeSection === section ? "page" : undefined
            }
            onClick={(event) => {
              event.preventDefault();
              onOpenWorkspace(section);
            }}
          >
            <span>{icon}</span> {label}
          </a>
        ))}
        <a
          className={`nav-item${page === "learn" ? " active" : ""}`}
          href="#learn"
          aria-current={page === "learn" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onLearn();
          }}
        >
          <span>◉</span> Learn
        </a>
        <a
          className={`nav-item${page === "playground" ? " active" : ""}`}
          href="#playground"
          aria-current={page === "playground" ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            onPlayground();
          }}
        >
          <span>{"</>"}</span> Code Playground
        </a>
      </nav>
      <div className="sidebar-bottom">
        <div className="status-dot" />
        <span>Workspace ready</span>
        <span className="version">v0.1</span>
      </div>
    </aside>
  );
}

function generateArray(): number[] {
  const length = Math.floor(Math.random() * 13) + 8;
  return Array.from({ length }, () => Math.floor(Math.random() * 90) + 10);
}

function formatProgressDate(value: string | undefined): string {
  if (!value) return "Recently";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTimeGreeting(date = new Date()): string {
  const hours = date.getHours();
  if (hours < 12) return "Good morning";
  if (hours < 18) return "Good afternoon";
  return "Good evening";
}

function App() {
  const [page, setPage] = useState<Page>(() =>
    resolveAppRoute(window.location.hash).page,
  );
  const [authStatus, setAuthStatus] = useState<
    "loading" | "signed-out" | "signed-in"
  >("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string>();
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [learningProgress, setLearningProgress] = useState<
    LearningProgressRecord[]
  >([]);
  const [progressState, setProgressState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [progressError, setProgressError] = useState<string>();
  const [progressNotice, setProgressNotice] = useState<string>();
  const [activeGraphTopicId, setActiveGraphTopicId] = useState(() => {
    const route = resolveAppRoute(window.location.hash);
    const topic = learningTopics.find(
      (candidate) => candidate.topicId === route.topicId,
    );
    return topic?.category === "graphs" ? topic.topicId : "graphs-bfs";
  });
  const [activeSection, setActiveSection] = useState<WorkspaceSection>(() => {
    const route = resolveAppRoute(window.location.hash);
    return (
      learningTopics.find((topic) => topic.topicId === route.topicId)?.section ??
      "sorting"
    );
  });
  const [activeStructure, setActiveStructure] = useState<
    "arrays" | "linked-lists" | "stacks-queues" | "trees"
  >(() => {
    const route = resolveAppRoute(window.location.hash);
    const topic = learningTopics.find(
      (candidate) => candidate.topicId === route.topicId,
    );
    return topic?.structure ?? "arrays";
  });
  const [values, setValues] = useState(initialValues);
  const [activeAlgorithm, setActiveAlgorithm] =
    useState<SortingAlgorithm>(() => {
      const route = resolveAppRoute(window.location.hash);
      const topic = learningTopics.find(
        (candidate) => candidate.topicId === route.topicId,
      );
      return (topic?.algorithm as SortingAlgorithm | undefined) ?? "Bubble Sort";
    });
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackDelay, setPlaybackDelay] = useState(450);

  const applyRoute = useCallback((route: AppRoute) => {
    setIsPlaying(false);
    setPage(route.page);
    const topic = learningTopics.find(
      (candidate) => candidate.topicId === route.topicId,
    );
    if (!topic) {
      if (route.page === "workspace") {
        setActiveSection("sorting");
        setActiveAlgorithm("Bubble Sort");
        setActiveGraphTopicId("graphs-bfs");
        setActiveStructure("arrays");
      }
      return;
    }
    setActiveSection(topic.section);
    if (topic.algorithm) setActiveAlgorithm(topic.algorithm as SortingAlgorithm);
    if (topic.structure) setActiveStructure(topic.structure);
    if (topic.category === "graphs") setActiveGraphTopicId(topic.topicId);
  }, []);

  const navigateToRoute = useCallback((route: AppRoute, replace = false) => {
    applyRoute(route);
    const hash = hashForRoute(route);
    if (window.location.hash === hash) return;
    if (replace) {
      window.history.replaceState(null, "", hash);
    } else {
      window.location.hash = hash;
    }
  }, [applyRoute]);

  const navigateToPage = useCallback((nextPage: Page) => {
    navigateToRoute({ page: nextPage });
  }, [navigateToRoute]);

  useEffect(() => {
    let isMounted = true;
    void getCurrentUser()
      .then((currentUser) => {
        if (!isMounted) return;
        setUser(currentUser);
        setAuthStatus(currentUser ? "signed-in" : "signed-out");
        const route = resolveStartupRoute(
          window.location.hash,
          currentUser !== null,
        );
        navigateToRoute(route, currentUser !== null && !window.location.hash);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setUser(null);
        setAuthStatus("signed-out");
        setAuthError(
          error instanceof Error
            ? error.message
            : "Could not check your sign-in session.",
        );
      });
    return () => {
      isMounted = false;
    };
  }, [navigateToRoute]);

  useEffect(() => {
    const handleHashChange = () => {
      const route = resolveAppRoute(window.location.hash);
      if (!window.location.hash && authStatus === "signed-in") {
        navigateToRoute({ page: "learn" }, true);
        return;
      }
      applyRoute(route);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [applyRoute, authStatus, navigateToRoute]);

  const loadLearningProgress = useCallback(async () => {
    setProgressState("loading");
    setProgressError(undefined);
    try {
      const progress = await getLearningProgress();
      setLearningProgress(progress);
      setProgressState("ready");
    } catch (error) {
      setProgressState("error");
      const message =
        error instanceof Error
          ? error.message
          : "Could not load your learning progress.";
      setProgressError(message);
      if (message.includes("Authentication is required") || message.includes("Session is invalid")) {
        setAuthStatus("signed-out");
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    if (page !== "learn" || authStatus !== "signed-in") return;
    let isMounted = true;
    void getLearningProgress()
      .then((progress) => {
        if (!isMounted) return;
        setLearningProgress(progress);
        setProgressState("ready");
        setProgressError(undefined);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setProgressState("error");
        const message =
          error instanceof Error
            ? error.message
            : "Could not load your learning progress.";
        setProgressError(message);
        if (message.includes("Authentication is required") || message.includes("Session is invalid")) {
          setAuthStatus("signed-out");
          setUser(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [authStatus, page]);

  const saveTopicProgress = useCallback(
    async (topic: LearningTopic, status: LearningProgressStatus) => {
      setProgressError(undefined);
      setProgressNotice(undefined);
      if (authStatus !== "signed-in") {
        setProgressNotice("Sign in to save your learning progress.");
        return;
      }
      if (
        status === "in-progress" &&
        learningProgress.some(
          (record) =>
            record.topicId === topic.topicId && record.status === "completed",
        )
      ) {
        setProgressNotice(`${topic.topicName} is already complete.`);
        return;
      }

      try {
        const savedProgress = await saveLearningProgress({
          topicId: topic.topicId,
          topicName: topic.topicName,
          category: topic.category,
          status,
        });
        setLearningProgress((current) => [
          savedProgress,
          ...current.filter((record) => record.topicId !== topic.topicId),
        ]);
        setProgressNotice(
          status === "completed"
            ? `${topic.topicName} marked complete.`
            : `${topic.topicName} saved to your learning progress.`,
        );
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not save your learning progress.";
        setProgressError(message);
        if (message.includes("Authentication is required") || message.includes("Session is invalid")) {
          setAuthStatus("signed-out");
          setUser(null);
        }
      }
    },
    [authStatus, learningProgress],
  );

  const handleGraphTopicStart = useCallback(
    (topicId: string) => {
      setActiveGraphTopicId(topicId);
      const topic = learningTopics.find(
        (candidate) => candidate.topicId === topicId,
      );
      if (topic) {
        navigateToRoute({ page: "workspace", topicId: topic.topicId });
        void saveTopicProgress(topic, "in-progress");
      }
    },
    [navigateToRoute, saveTopicProgress],
  );

  const handleGraphTopicComplete = useCallback(
    (topicId: string) => {
      const topic = learningTopics.find(
        (candidate) => candidate.topicId === topicId,
      );
      if (topic) void saveTopicProgress(topic, "completed");
    },
    [saveTopicProgress],
  );

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setIsAuthBusy(true);
    setAuthError(undefined);
    try {
      const signedInUser = await signInWithGoogle(idToken);
      setLearningProgress([]);
      setProgressState("idle");
      setProgressError(undefined);
      setUser(signedInUser);
      setAuthStatus("signed-in");
      navigateToPage("learn");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Google sign-in failed.",
      );
    } finally {
      setIsAuthBusy(false);
    }
  }, [navigateToPage]);

  const handleGoogleError = useCallback((message: string) => {
    setAuthError(message);
  }, []);

  async function handleLogout() {
    setIsAuthBusy(true);
    setAuthError(undefined);
    try {
      await signOut();
      setLearningProgress([]);
      setProgressState("idle");
      setProgressError(undefined);
      setUser(null);
      setAuthStatus("signed-out");
      navigateToPage("landing");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Sign-out failed.",
      );
    } finally {
      setIsAuthBusy(false);
    }
  }

  function topicForSection(section: WorkspaceSection): LearningTopic {
    const topicId =
      section === "sorting"
        ? `sorting-${activeAlgorithm.toLowerCase().replaceAll(" ", "-")}`
        : section === "structures"
          ? `data-structures-${activeStructure}`
          : activeGraphTopicId;
    return learningTopics.find((topic) => topic.topicId === topicId)!;
  }

  function openWorkspace(section: WorkspaceSection = "sorting") {
    const topic = topicForSection(section);
    navigateToRoute({ page: "workspace", topicId: topic.topicId });
    void saveTopicProgress(topic, "in-progress");
  }

  function openTopic(topic: LearningTopic) {
    setIsPlaying(false);
    if (topic.algorithm) setStep(0);
    navigateToRoute({ page: "workspace", topicId: topic.topicId });
    void saveTopicProgress(topic, "in-progress");
  }

  const sorting = useMemo(
    () => typeScriptSortingEngine.sort(activeAlgorithm, values),
    [activeAlgorithm, values],
  );
  const replay = replaySortingEvents(
    values,
    sorting.events,
    step,
    activeAlgorithm,
  );
  const {
    values: currentValues,
    comparisons,
    swaps,
    movements,
    minimumIndex,
    keyIndex,
    heldKey,
    mergeRange,
    partitionRange,
    pivotIndex,
    pivotValue,
    partitionBoundary,
    sortedIndices,
    activeEvent,
    activeIndices,
  } = replay;
  const stepDetails = getSortingStepDetails(
    activeAlgorithm,
    activeEvent,
    replay,
  );
  const isComplete = step === sorting.events.length;
  const progress = sorting.events.length
    ? (step / sorting.events.length) * 100
    : 0;

  useEffect(() => {
    if (
      !isPlaying ||
      page !== "workspace" ||
      activeSection !== "sorting" ||
      step >= sorting.events.length
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const nextStep = Math.min(step + 1, sorting.events.length);
      setStep(nextStep);
      if (nextStep >= sorting.events.length) {
        setIsPlaying(false);
        const topic = learningTopics.find(
          (candidate) => candidate.algorithm === activeAlgorithm,
        );
        if (topic) void saveTopicProgress(topic, "completed");
      }
    }, playbackDelay);

    return () => window.clearTimeout(timeout);
  }, [activeAlgorithm, activeSection, isPlaying, page, playbackDelay, saveTopicProgress, step, sorting.events.length]);

  function resetVisualization() {
    setIsPlaying(false);
    setStep(0);
  }

  function generateNewArray() {
    setIsPlaying(false);
    setValues(generateArray());
    setStep(0);
    void saveTopicProgress(topicForSection("sorting"), "in-progress");
  }

  function stepForward() {
    setIsPlaying(false);
    const nextStep = Math.min(step + 1, sorting.events.length);
    const topic = topicForSection("sorting");
    void saveTopicProgress(
      topic,
      nextStep >= sorting.events.length ? "completed" : "in-progress",
    );
    setStep((currentStep) =>
      Math.min(currentStep + 1, sorting.events.length),
    );
  }

  function stepBackward() {
    setIsPlaying(false);
    setStep((currentStep) => Math.max(currentStep - 1, 0));
  }

  function changeAlgorithm(algorithm: SortingAlgorithm) {
    setIsPlaying(false);
    setStep(0);
    setActiveAlgorithm(algorithm);
    const topic = learningTopics.find(
      (candidate) => candidate.algorithm === algorithm,
    );
    if (topic) {
      navigateToRoute({ page: "workspace", topicId: topic.topicId });
      void saveTopicProgress(topic, "in-progress");
    }
  }

  function selectStructure(
    structure: "arrays" | "linked-lists" | "stacks-queues" | "trees",
  ) {
    setActiveStructure(structure);
    const topic = learningTopics.find(
      (candidate) => candidate.structure === structure,
    );
    if (topic) {
      navigateToRoute({ page: "workspace", topicId: topic.topicId });
      void saveTopicProgress(topic, "in-progress");
    }
  }

  const activeLearningTopic = topicForSection(activeSection);
  const activeTopicProgress = learningProgress.find(
    (record) => record.topicId === activeLearningTopic.topicId,
  );
  const progressByTopic = new Map(
    learningProgress.map((record) => [record.topicId, record]),
  );
  const getTopicStatus = (topic: LearningTopic): LearningProgressStatus =>
    progressByTopic.get(topic.topicId)?.status ?? "not-started";
  const completedCount = learningTopics.filter(
    (topic) => getTopicStatus(topic) === "completed",
  ).length;
  const inProgressCount = learningTopics.filter(
    (topic) => getTopicStatus(topic) === "in-progress",
  ).length;
  const notStartedCount = learningTopics.length - completedCount - inProgressCount;
  const overallProgress = Math.round(
    (completedCount / learningTopics.length) * 100,
  );
  const mostRecentInProgress = learningProgress.find(
    (record) => record.status === "in-progress",
  );
  const continueTopic =
    (mostRecentInProgress &&
      learningTopics.find(
        (topic) => topic.topicId === mostRecentInProgress.topicId,
      )) ??
    learningTopics.find((topic) => getTopicStatus(topic) === "not-started");
  const recentProgress = learningProgress.slice(0, 5);
  const categoryCards = [
    { category: "sorting" as const, title: "Sorting", icon: "▥" },
    {
      category: "data-structures" as const,
      title: "Data Structures",
      icon: "▤",
    },
    { category: "graphs" as const, title: "Graphs", icon: "⌘" },
  ].map((item) => {
    const topics = learningTopics.filter(
      (topic) => topic.category === item.category,
    );
    const completed = topics.filter(
      (topic) => getTopicStatus(topic) === "completed",
    ).length;
    return {
      ...item,
      total: topics.length,
      completed,
      percent: Math.round((completed / topics.length) * 100),
    };
  });

  if (authStatus === "loading") {
    return (
      <div className="auth-initializing" aria-live="polite">
        <section className="learn-loading-card">
          <span className="loading-spinner" />
          <span>Checking your sign-in session…</span>
        </section>
      </div>
    );
  }

  if (page === "landing") {
    return (
      <div className="landing-page">
        <header className="landing-nav">
          <a className="landing-brand" href="#home" aria-label="AlgoCanvas home">
            <img src="/logo.png" alt="AlgoCanvas" />
          </a>
          <div className="landing-nav-actions">
            <button
              className="landing-nav-link"
              type="button"
              onClick={() => openWorkspace()}
            >
              Explore tools
            </button>
            {authStatus === "signed-in" ? (
              <>
                {user && (
                  <button
                    className="landing-account-button"
                    type="button"
                    aria-label="Open profile"
                    onClick={() => navigateToPage("profile")}
                  >
                    {user.avatar ? (
                      <img src={user.avatar} alt="" />
                    ) : (
                      <span>{(user.displayName || user.name).slice(0, 1).toUpperCase()}</span>
                    )}
                  </button>
                )}
                <button
                  className="landing-nav-link"
                  type="button"
                  onClick={() => navigateToPage("learn")}
                >
                  My learning
                </button>
                <button
                  className="landing-signout"
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isAuthBusy}
                >
                  Sign out
                </button>
              </>
            ) : (
              <span className="landing-nav-note">Learn at your pace</span>
            )}
          </div>
        </header>

        <main>
          <section className="landing-hero">
            <div className="landing-copy">
              <div className="landing-eyebrow">
                <span className="status-dot" /> INTERACTIVE COMPUTER SCIENCE
              </div>
              <h1>
                Make algorithms
                <br />
                <span>click into place.</span>
              </h1>
              <p className="landing-description">
                AlgoCanvas turns abstract computer science concepts into
                interactive visual experiences. Explore a step at a time, and
                learn by seeing how things work.
              </p>
              <div className="landing-actions">
                {authStatus === "signed-in" ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => navigateToPage("learn")}
                  >
                    Continue learning <span aria-hidden="true">→</span>
                  </button>
                ) : (
                  <div className="google-button-wrap">
                    <GoogleSignInButton
                      disabled={isAuthBusy}
                      onCredential={handleGoogleCredential}
                      onError={handleGoogleError}
                    />
                    {isAuthBusy && (
                      <span className="auth-busy-label">Signing you in…</span>
                    )}
                  </div>
                )}
                <button
                  className="secondary-landing-button"
                  type="button"
                  onClick={() => openWorkspace()}
                >
                  Explore AlgoCanvas <span aria-hidden="true">↗</span>
                </button>
              </div>
              {authError && (
                <div className="auth-error" role="alert">
                  <span>{authError}</span>
                  <button type="button" onClick={() => setAuthError(undefined)}>
                    Dismiss
                  </button>
                </div>
              )}
              <div className="landing-reassurance">
                <span>↳</span> Sorting, data structures, and graphs — free to explore
              </div>
            </div>
            <div className="landing-art" aria-label="Abstract algorithm visualization">
              <div className="art-orbit art-orbit-one" />
              <div className="art-orbit art-orbit-two" />
              <div className="art-glow" />
              <div className="art-card">
                <div className="art-card-header">
                  <span><i /> LIVE VISUALIZATION</span>
                  <span>MERGE SORT</span>
                </div>
                <div className="art-array art-array-top">
                  {[42, 72, 34, 88, 56, 24, 65, 48].map((height, index) => (
                    <div className="art-array-column" key={index}>
                      <span style={{ height: `${height}%` }} />
                    </div>
                  ))}
                </div>
                <div className="art-connector"><span>divide</span><i /><i /></div>
                <div className="art-array art-array-bottom">
                  {[24, 34, 42, 48, 56, 65, 72, 88].map((height, index) => (
                    <div className="art-array-column" key={index}>
                      <span style={{ height: `${height}%` }} />
                    </div>
                  ))}
                </div>
                <div className="art-card-footer">
                  <span><i className="art-dot-violet" /> Compare</span>
                  <span><i className="art-dot-mint" /> In order</span>
                  <span>STEP 08 / 24</span>
                </div>
              </div>
              <div className="art-floating-note note-top">one step at a time <span>✳</span></div>
              <div className="art-floating-note note-bottom"><span>↗</span> understand the why</div>
            </div>
          </section>

          <section className="landing-tools" aria-labelledby="tools-title">
            <div className="tools-heading">
              <div>
                <div className="eyebrow">YOUR INTERACTIVE WORKSPACE</div>
                <h2 id="tools-title">Explore ideas, not just code.</h2>
              </div>
              <p>Choose a lab and start experimenting. No account required.</p>
            </div>
            <div className="tool-card-grid">
              <button
                className="landing-tool-card"
                type="button"
                onClick={() => openWorkspace("sorting")}
              >
                <span className="tool-card-icon violet">▥</span>
                <span className="tool-card-title">Sorting Lab</span>
                <span className="tool-card-description">
                  Watch values move as classic sorting algorithms work.
                </span>
                <span className="tool-card-link">Open lab <b>→</b></span>
              </button>
              <button
                className="landing-tool-card"
                type="button"
                onClick={() => openWorkspace("structures")}
              >
                <span className="tool-card-icon mint">▤</span>
                <span className="tool-card-title">Data Structures</span>
                <span className="tool-card-description">
                  Explore arrays, linked lists, stacks, queues, and trees.
                </span>
                <span className="tool-card-link">Explore structures <b>→</b></span>
              </button>
              <button
                className="landing-tool-card"
                type="button"
                onClick={() => openWorkspace("graphs")}
              >
                <span className="tool-card-icon amber">⌘</span>
                <span className="tool-card-title">Graph Explorer</span>
                <span className="tool-card-description">
                  See how graph algorithms discover paths and connections.
                </span>
                <span className="tool-card-link">Open explorer <b>→</b></span>
              </button>
            </div>
          </section>
          <footer className="landing-footer">
            <span>ALGOCANVAS <b>/</b> BUILT TO UNDERSTAND</span>
            <span>More than code. A way to see it.</span>
          </footer>
        </main>
      </div>
    );
  }

  if (page === "learn") {
    return (
      <div className="app-shell">
        <NavigationSidebar
          activeSection={activeSection}
          page={page}
          onHome={() => navigateToPage("landing")}
          onLearn={() => navigateToPage("learn")}
          onPlayground={() => navigateToPage("playground")}
          onOpenWorkspace={openWorkspace}
        />
        <main className="main-content learn-main">
          <header className="topbar">
            <div>
              <div className="breadcrumb">Workspace / Learn</div>
              <h1>Learn dashboard</h1>
            </div>
            <div className="header-right">
              {authStatus === "signed-in" && user ? (
                <AccountMenu
                  user={user}
                  isBusy={isAuthBusy}
                  onNavigate={navigateToPage}
                  onLogout={() => void handleLogout()}
                />
              ) : (
                <span className="engine-status">
                  <span className="status-dot" />
                  Sign in to learn
                </span>
              )}
            </div>
          </header>
          {authStatus === "signed-out" ? (
            <section className="learn-state-card learn-locked">
              <span className="learn-state-icon">◉</span>
              <div className="eyebrow">YOUR LEARNING SPACE</div>
              <h2>Sign in to see your learning dashboard.</h2>
              <p>
                Your personalized learning space is for signed-in learners.
                You can still explore every interactive lab without an account.
              </p>
              <div className="learn-state-actions">
                <div className="google-button-wrap">
                  <GoogleSignInButton
                    disabled={isAuthBusy}
                    onCredential={handleGoogleCredential}
                    onError={handleGoogleError}
                  />
                  {isAuthBusy && (
                    <span className="auth-busy-label">Signing you in…</span>
                  )}
                </div>
                <button
                  className="secondary-landing-button"
                  type="button"
                  onClick={() => openWorkspace()}
                >
                  Explore AlgoCanvas <span aria-hidden="true">↗</span>
                </button>
              </div>
              {authError && (
                <div className="auth-error" role="alert">
                  <span>{authError}</span>
                  <button type="button" onClick={() => setAuthError(undefined)}>
                    Dismiss
                  </button>
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="learn-welcome">
                <div className="learn-welcome-copy">
                  <div className="eyebrow">YOUR LEARNING SPACE</div>
                  <h2>
                    {getTimeGreeting()}, {user?.name.split(" ")[0] || "learner"}.
                  </h2>
                  <p>
                    {continueTopic
                      ? `Your next step is ${continueTopic.topicName}. Keep the momentum going with a focused session in ${continueTopic.category === "data-structures" ? "data structures" : continueTopic.category}.`
                      : completedCount > 0
                        ? `You have completed ${completedCount} topic${completedCount === 1 ? "" : "s"}. Keep building on that momentum with a quick review or new challenge.`
                        : "Start with a beginner-friendly concept and build your confidence one topic at a time."}
                  </p>
                  <div className="learn-welcome-actions">
                    {continueTopic ? (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => openTopic(continueTopic)}
                      >
                        Continue learning <span aria-hidden="true">→</span>
                      </button>
                    ) : (
                      <button
                        className="primary-button"
                        type="button"
                        onClick={() => openWorkspace("sorting")}
                      >
                        Start with sorting <span aria-hidden="true">→</span>
                      </button>
                    )}
                    <button
                      className="secondary-landing-button"
                      type="button"
                      onClick={() => openWorkspace()}
                    >
                      Browse labs
                    </button>
                  </div>
                </div>
                <div className="welcome-progress">
                  <div
                    className="welcome-progress-ring"
                    style={{
                      background: `conic-gradient(#c7f36b ${overallProgress}%, #343448 0)`,
                    }}
                  >
                    <span>{progressState === "ready" ? `${overallProgress}%` : "—"}</span>
                  </div>
                  <div>
                    <strong>Learning journey</strong>
                    <span>
                      {progressState === "ready"
                        ? `${completedCount} of ${learningTopics.length} topics completed`
                        : "Progress summary"}
                    </span>
                  </div>
                </div>
              </section>

              {progressError && progressState !== "error" && (
                <div className="progress-error" role="alert">
                  <span>{progressError}</span>
                  <button
                    type="button"
                    onClick={() => void loadLearningProgress()}
                    disabled={progressState === "loading"}
                  >
                    Try again
                  </button>
                </div>
              )}

              {progressState === "loading" || progressState === "idle" ? (
                <section className="learn-loading-card" aria-live="polite">
                  <span className="loading-spinner" />
                  <span>Loading your learning progress…</span>
                </section>
              ) : progressState === "ready" ? (
                <>
                  <LearningGoalPanel
                    completedTopics={completedCount}
                    maximumTopics={learningTopics.length}
                  />
                  <section className="learn-stat-grid" aria-label="Progress summary">
                    <article className="learn-stat-card learn-stat-overall">
                      <span className="learn-stat-icon">◉</span>
                      <div>
                        <span className="learn-stat-label">OVERALL PROGRESS</span>
                        <strong>{overallProgress}%</strong>
                        <span className="learn-stat-caption">
                          {completedCount} of {learningTopics.length} topics completed
                        </span>
                      </div>
                    </article>
                    <article className="learn-stat-card">
                      <span className="learn-stat-icon stat-mint">✓</span>
                      <div>
                        <span className="learn-stat-label">COMPLETED</span>
                        <strong>{completedCount}</strong>
                        <span className="learn-stat-caption">Topics completed</span>
                      </div>
                    </article>
                    <article className="learn-stat-card">
                      <span className="learn-stat-icon stat-violet">◷</span>
                      <div>
                        <span className="learn-stat-label">IN PROGRESS</span>
                        <strong>{inProgressCount}</strong>
                        <span className="learn-stat-caption">Topics underway</span>
                      </div>
                    </article>
                    <article className="learn-stat-card">
                      <span className="learn-stat-icon stat-muted">○</span>
                      <div>
                        <span className="learn-stat-label">NOT STARTED</span>
                        <strong>{notStartedCount}</strong>
                        <span className="learn-stat-caption">Ready when you are</span>
                      </div>
                    </article>
                  </section>

                  {progressNotice && (
                    <div className="progress-notice" role="status">
                      <span>{progressNotice}</span>
                      <button
                        type="button"
                        aria-label="Dismiss progress message"
                        onClick={() => setProgressNotice(undefined)}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <section className="learn-panel quick-actions-panel" aria-label="Quick actions">
                    <div className="learn-panel-heading">
                      <div>
                        <div className="eyebrow">QUICK ACTIONS</div>
                        <h3>Jump back in</h3>
                      </div>
                    </div>
                    <div className="quick-actions-grid">
                      <button type="button" className="quick-action-button" onClick={() => openWorkspace("sorting")}>
                        <span className="quick-action-icon violet">▥</span>
                        <span className="quick-action-copy">
                          <strong>Sorting Lab</strong>
                          <small>Compare algorithms</small>
                        </span>
                      </button>
                      <button type="button" className="quick-action-button" onClick={() => openWorkspace("structures")}>
                        <span className="quick-action-icon mint">▤</span>
                        <span className="quick-action-copy">
                          <strong>Data Structures</strong>
                          <small>Explore nodes and queues</small>
                        </span>
                      </button>
                      <button type="button" className="quick-action-button" onClick={() => openWorkspace("graphs")}>
                        <span className="quick-action-icon amber">⌘</span>
                        <span className="quick-action-copy">
                          <strong>Graph Explorer</strong>
                          <small>Trace paths and traversal</small>
                        </span>
                      </button>
                      <button type="button" className="quick-action-button" onClick={() => navigateToPage("learn")}>
                        <span className="quick-action-icon neutral">◉</span>
                        <span className="quick-action-copy">
                          <strong>Learn</strong>
                          <small>See your dashboard</small>
                        </span>
                      </button>
                    </div>
                  </section>

                  <div className="learn-dashboard-grid">
                    <section className="learn-panel continue-panel">
                      <div className="learn-panel-heading">
                        <div>
                          <div className="eyebrow">PICK UP WHERE YOU LEFT OFF</div>
                          <h3>Continue learning</h3>
                        </div>
                        <span className="panel-heading-icon">↗</span>
                      </div>
                      {continueTopic ? (
                        <div className="continue-topic">
                          <span className={`topic-icon ${continueTopic.category}`}>
                            {continueTopic.category === "sorting"
                              ? "▥"
                              : continueTopic.category === "data-structures"
                                ? "▤"
                                : "⌘"}
                          </span>
                          <div className="continue-topic-copy">
                            <span className="topic-category-label">
                              {continueTopic.category === "data-structures"
                                ? "DATA STRUCTURES"
                                : continueTopic.category.toUpperCase()}
                            </span>
                            <h4>{continueTopic.topicName}</h4>
                            <span className={`topic-status ${getTopicStatus(continueTopic)}`}>
                              {getTopicStatus(continueTopic) === "in-progress"
                                ? "In progress"
                                : "Not started"}
                            </span>
                          </div>
                          <button
                            className="primary-button"
                            type="button"
                            onClick={() => openTopic(continueTopic)}
                          >
                            Continue <span aria-hidden="true">→</span>
                          </button>
                        </div>
                      ) : (
                        <div className="learn-all-complete">
                          <span className="learn-state-icon">✳</span>
                          <h4>You’ve completed every listed topic.</h4>
                          <p>Revisit any tool to explore it again.</p>
                          <button
                            className="secondary-landing-button"
                            type="button"
                            onClick={() => openWorkspace()}
                          >
                            Explore the labs <span aria-hidden="true">↗</span>
                          </button>
                        </div>
                      )}
                      {learningProgress.length === 0 && (
                        <p className="new-learner-note">
                          Your dashboard is ready. Start with any topic and
                          your real activity will appear here.
                        </p>
                      )}
                    </section>

                    <section className="learn-panel recent-panel">
                      <div className="learn-panel-heading">
                        <div>
                          <div className="eyebrow">YOUR LATEST ACTIVITY</div>
                          <h3>Recent learning</h3>
                        </div>
                      </div>
                      {recentProgress.length ? (
                        <ul className="recent-activity-list">
                          {recentProgress.map((record) => {
                            const topic = learningTopics.find(
                              (item) => item.topicId === record.topicId,
                            );
                            return (
                              <li key={record.topicId}>
                                <span className={`activity-mark ${record.status}`}>
                                  {record.status === "completed" ? "✓" : "◷"}
                                </span>
                                <span className="activity-copy">
                                  <strong>{record.topicName}</strong>
                                  <span>
                                    {record.status === "completed"
                                      ? "Completed"
                                      : record.status === "in-progress"
                                        ? "In progress"
                                        : "Marked not started"}
                                  </span>
                                </span>
                                <time dateTime={record.updatedAt}>
                                  {formatProgressDate(record.updatedAt)}
                                </time>
                                {topic && (
                                  <button
                                    className="activity-open-button"
                                    type="button"
                                    aria-label={`Open ${record.topicName}`}
                                    onClick={() => openTopic(topic)}
                                  >
                                    →
                                  </button>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <div className="recent-empty-state">
                          <span>Recent activity will show up as you explore topics.</span>
                        </div>
                      )}
                    </section>
                  </div>

                  <section className="learn-panel category-panel">
                    <div className="learn-panel-heading">
                      <div>
                        <div className="eyebrow">EXPLORE BY SUBJECT</div>
                        <h3>Learning paths</h3>
                      </div>
                    </div>
                    <div className="category-progress-grid">
                      {categoryCards.map((category) => (
                        <article className="category-progress-card" key={category.category}>
                          <div className="category-progress-top">
                            <span className={`topic-icon ${category.category}`}>
                              {category.icon}
                            </span>
                            <span>{category.completed}/{category.total}</span>
                          </div>
                          <h4>{category.title}</h4>
                          <div
                            className="category-progress-track"
                            role="progressbar"
                            aria-label={`${category.title} progress`}
                            aria-valuemin={0}
                            aria-valuemax={category.total}
                            aria-valuenow={category.completed}
                          >
                            <span style={{ width: `${category.percent}%` }} />
                          </div>
                          <div className="category-progress-footer">
                            <span>
                              {category.completed} of {category.total} complete
                            </span>
                            <button
                              type="button"
                              onClick={() => openTopic(
                                learningTopics.find((topic) => topic.category === category.category)!,
                              )}
                            >
                              Explore <span aria-hidden="true">→</span>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : (
                <section className="learn-error-card">
                  <span className="learn-state-icon">!</span>
                  <h2>Progress could not be loaded.</h2>
                  <p>
                    Your sign-in is still active. Check your connection and try
                    loading your saved progress again.
                  </p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => void loadLearningProgress()}
                  >
                    Retry loading <span aria-hidden="true">↻</span>
                  </button>
                </section>
              )}
              {authError && (
                <div className="auth-error" role="alert">
                  <span>{authError}</span>
                  <button type="button" onClick={() => setAuthError(undefined)}>
                    Dismiss
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    );
  }

  if (page === "profile" || page === "settings") {
    return (
      <div className="app-shell">
        <NavigationSidebar
          activeSection={activeSection}
          page={page}
          onHome={() => navigateToPage("landing")}
          onLearn={() => navigateToPage("learn")}
          onPlayground={() => navigateToPage("playground")}
          onOpenWorkspace={openWorkspace}
        />
        <main className="main-content account-main">
          <header className="topbar">
            <div>
              <div className="breadcrumb">Workspace / Account</div>
              <h1>{page === "profile" ? "Profile" : "Settings"}</h1>
            </div>
            {authStatus === "signed-in" && user && (
              <div className="header-right">
                <AccountMenu
                  user={user}
                  isBusy={isAuthBusy}
                  onNavigate={navigateToPage}
                  onLogout={() => void handleLogout()}
                />
              </div>
            )}
          </header>
          {authStatus === "signed-in" && user ? (
            <AccountPage
              page={page}
              user={user}
              isAuthBusy={isAuthBusy}
              onNavigate={navigateToPage}
              onUserUpdate={setUser}
              onLogout={() => void handleLogout()}
              onAccountDeleted={() => {
                setLearningProgress([]);
                setProgressState("idle");
                setUser(null);
                setAuthStatus("signed-out");
                navigateToPage("landing");
              }}
            />
          ) : (
            <section className="account-state-card">
              <span className="account-eyebrow">YOUR ACCOUNT</span>
              <h2>Sign in to manage your account.</h2>
              <p>Profile details and learning progress are available after Google sign-in.</p>
              <button
                className="account-primary-button"
                type="button"
                onClick={() => navigateToPage("learn")}
              >
                Go to sign in
              </button>
            </section>
          )}
        </main>
      </div>
    );
  }

  if (page === "playground") {
    return (
      <div className="app-shell">
        <NavigationSidebar
          activeSection={activeSection}
          page={page}
          onHome={() => navigateToPage("landing")}
          onLearn={() => navigateToPage("learn")}
          onPlayground={() => navigateToPage("playground")}
          onOpenWorkspace={openWorkspace}
        />
        <main className="main-content playground-main">
          <header className="topbar">
            <div>
              <div className="breadcrumb">Workspace / Code Playground</div>
              <h1>Code Playground</h1>
            </div>
            <div className="header-right">
              <span className="engine-status">
                <span className="status-dot" />
                Wandbox sandbox
              </span>
              {authStatus === "signed-in" && user ? (
                <AccountMenu
                  user={user}
                  isBusy={isAuthBusy}
                  onNavigate={navigateToPage}
                  onLogout={() => void handleLogout()}
                />
              ) : (
                <button
                  className="topbar-signout"
                  type="button"
                  onClick={() => navigateToPage("learn")}
                >
                  Sign in
                </button>
              )}
            </div>
          </header>
          <CodePlayground
            preferredLanguage={user?.preferences?.preferredLanguage}
            editorFontSize={user?.preferences?.editorFontSize}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <NavigationSidebar
        activeSection={activeSection}
        page={page}
        onHome={() => navigateToPage("landing")}
        onLearn={() => navigateToPage("learn")}
        onPlayground={() => navigateToPage("playground")}
        onOpenWorkspace={openWorkspace}
      />

      <main
        className="main-content"
        id={activeSection === "sorting" ? "sorting" : activeSection}
      >
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              Workspace / {activeSection === "sorting"
                ? "Sorting Lab"
                : activeSection === "structures"
                  ? "Data Structures"
                  : "Graph Explorer"}
            </div>
            <h1>
              {activeSection === "graphs"
                ? "Graph Algorithms Lab"
                : activeSection === "sorting"
                  ? "Algorithm playground"
                  : activeStructure === "arrays"
                  ? "Arrays"
                  : activeStructure === "linked-lists"
                    ? "Singly Linked Lists"
                    : activeStructure === "stacks-queues"
                      ? "Stacks & Queues"
                      : "Trees"}
            </h1>
          </div>
          <div className="header-right">
            <span className="engine-status">
              <span className="status-dot" />
              {authStatus === "signed-in" ? "Signed in" : "Preview mode"}
            </span>
            {authStatus === "signed-in" && user ? (
              <AccountMenu
                user={user}
                isBusy={isAuthBusy}
                onNavigate={navigateToPage}
                onLogout={() => void handleLogout()}
              />
            ) : (
              <button
                className="topbar-signout"
                type="button"
                onClick={() => navigateToPage("learn")}
              >
                Sign in
              </button>
            )}
          </div>
        </header>

        {authError && (
          <div className="auth-error workspace-auth-error" role="alert">
            <span>{authError}</span>
            <button type="button" onClick={() => setAuthError(undefined)}>
              Dismiss
            </button>
          </div>
        )}

        <section className="workspace-progress-bar" aria-label="Topic progress">
          <div>
            <span className="eyebrow">
              {activeLearningTopic.category === "data-structures"
                ? "DATA STRUCTURES"
                : activeLearningTopic.category.toUpperCase()}
            </span>
            <strong>{activeLearningTopic.topicName}</strong>
            <span className={`topic-status ${activeTopicProgress?.status ?? "not-started"}`}>
              {activeTopicProgress?.status === "completed"
                ? "Completed"
                : activeTopicProgress?.status === "in-progress"
                  ? "In progress"
                  : "Not started"}
            </span>
          </div>
          {authStatus === "signed-in" ? (
            <button
              className="complete-topic-button"
              type="button"
              onClick={() =>
                void saveTopicProgress(activeLearningTopic, "completed")
              }
              disabled={activeTopicProgress?.status === "completed"}
            >
              {activeTopicProgress?.status === "completed"
                ? "✓ Completed"
                : "Mark topic complete"}
            </button>
          ) : (
            <button
              className="complete-topic-button"
              type="button"
              onClick={() => navigateToPage("learn")}
            >
              Sign in to save progress
            </button>
          )}
          {(progressNotice || progressError) && (
            <span
              className={progressError ? "tracker-message error" : "tracker-message"}
              role={progressError ? "alert" : "status"}
            >
              {progressError ?? progressNotice}
            </span>
          )}
        </section>

        {activeSection === "graphs" ? (
          <GraphExplorer
            algorithm={graphAlgorithmForTopic(activeGraphTopicId) ?? "bfs"}
            onTopicStart={handleGraphTopicStart}
            onTopicComplete={handleGraphTopicComplete}
          />
        ) : activeSection === "structures" ? (
          <>
            <nav className="structure-tabs" aria-label="Data structure modules">
              <button
                className={`structure-tab${activeStructure === "arrays" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "arrays"}
                onClick={() => selectStructure("arrays")}
              >
                Arrays
              </button>
              <button
                className={`structure-tab${activeStructure === "linked-lists" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "linked-lists"}
                onClick={() => selectStructure("linked-lists")}
              >
                Linked Lists
              </button>
              <button
                className={`structure-tab${activeStructure === "stacks-queues" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "stacks-queues"}
                onClick={() => selectStructure("stacks-queues")}
              >
                Stacks &amp; Queues
              </button>
              <button
                className={`structure-tab${activeStructure === "trees" ? " active" : ""}`}
                type="button"
                aria-pressed={activeStructure === "trees"}
                onClick={() => selectStructure("trees")}
              >
                Trees
              </button>
            </nav>
            {activeStructure === "arrays" ? (
              <ArraysVisualizer />
            ) : activeStructure === "linked-lists" ? (
              <LinkedListVisualizer />
            ) : activeStructure === "stacks-queues" ? (
              <StacksQueuesVisualizer />
            ) : (
              <TreesVisualizer />
            )}
          </>
        ) : (
          <>
        <section className="intro">
          <div>
            <div className="eyebrow">LEARN BY VISUALIZING</div>
            <h2>Make algorithms <span>click.</span></h2>
            <p>Explore the logic behind every comparison, swap, and decision.</p>
          </div>
          <div className="intro-decoration" aria-hidden="true">
            <span>01</span>
            <div className="decoration-line" />
            <span>∞</span>
          </div>
        </section>

        <section className="workspace-card">
          <div className="section-heading">
            <div>
              <div className="eyebrow">SORTING LAB</div>
              <h3>Visualize a sorting algorithm</h3>
            </div>
            <span className="complexity-badge">
              TIME ·{" "}
              {activeAlgorithm === "Merge Sort"
                ? "O(n log n)"
                : activeAlgorithm === "Quick Sort"
                  ? "O(n²) WORST"
                  : "O(n²)"}
            </span>
          </div>

          <div className="toolbar">
            <label className="select-label" htmlFor="algorithm">
              Algorithm
              <select
                id="algorithm"
                value={activeAlgorithm}
                aria-describedby="algorithm-availability"
                onChange={(event) => {
                  const algorithm = event.target.value;
                  if (
                    algorithm === "Bubble Sort" ||
                    algorithm === "Selection Sort" ||
                    algorithm === "Insertion Sort" ||
                    algorithm === "Merge Sort" ||
                    algorithm === "Quick Sort"
                  ) {
                    changeAlgorithm(algorithm);
                  }
                }}
              >
                <option value="Bubble Sort">Bubble Sort</option>
                <option value="Selection Sort">Selection Sort</option>
                <option value="Insertion Sort">Insertion Sort</option>
                <option value="Merge Sort">Merge Sort</option>
                <option value="Quick Sort">Quick Sort</option>
              </select>
              <span id="algorithm-availability" className="visually-hidden">
                Bubble Sort, Selection Sort, Insertion Sort, Merge Sort, and Quick Sort are available.
              </span>
            </label>

            <button
              className="secondary-button"
              onClick={generateNewArray}
            >
              ↻ Shuffle / Generate Array
            </button>
            <button className="secondary-button" onClick={resetVisualization}>
              Reset
            </button>
          </div>

          <div className="visualization-area">
            <div className="canvas-topline">
              <span>ARRAY VISUALIZATION</span>
              <span>
                {heldKey !== undefined
                  ? `KEY: ${heldKey} · ${values.length} ELEMENTS`
                  : mergeRange
                    ? `MERGING ${mergeRange.start}–${mergeRange.end}`
                    : partitionRange
                      ? `PARTITION ${partitionRange.start}–${partitionRange.end}${pivotValue !== undefined ? ` · PIVOT ${pivotValue}` : ""}`
                  : `${values.length} ELEMENTS`}
              </span>
            </div>

            <div
              className="bars"
              role="group"
              aria-label={`${activeAlgorithm} array visualization`}
            >
              {currentValues.map((value, index) => {
                const isActive = activeIndices.includes(index);
                const inMergeRange =
                  mergeRange !== undefined &&
                  index >= mergeRange.start &&
                  index <= mergeRange.end;
                const inDivideRange =
                  activeEvent?.type === "divide" &&
                  index >= activeEvent.start &&
                  index <= activeEvent.end;
                const inPartitionRange =
                  partitionRange !== undefined &&
                  index >= partitionRange.start &&
                  index <= partitionRange.end;
                const barClass =
                isComplete
                    ? "bar-sorted"
                    : activeEvent?.type === "compare" &&
                        isActive &&
                        index !== pivotIndex
                      ? "bar-comparing"
                      : activeEvent?.type === "swap" && isActive
                        ? "bar-swapping"
                        : activeEvent?.type === "compare" &&
                            inPartitionRange &&
                            index !== pivotIndex
                          ? "bar-comparing"
                        : activeEvent?.type === "shift" && isActive
                          ? "bar-shifting"
                          : (activeEvent?.type === "write" ||
                                activeEvent?.type === "mergeWrite") &&
                              isActive
                            ? "bar-writing"
                            : inMergeRange
                              ? "bar-merging"
                                : inPartitionRange && index === pivotIndex
                                  ? "bar-pivot"
                                  : inPartitionRange && index === partitionBoundary
                                    ? "bar-boundary"
                                : inPartitionRange
                                  ? "bar-partition"
                                : sortedIndices.has(index)
                                  ? "bar-sorted"
                                : inDivideRange
                                  ? "bar-dividing"
                                : index === minimumIndex
                                  ? "bar-minimum"
                                  : index === keyIndex
                                    ? "bar-key"
                                    : index === pivotIndex
                                      ? "bar-pivot"
                                      : index === partitionBoundary && inPartitionRange
                                        ? "bar-boundary"
                                    : isActive
                                      ? "bar-comparing"
                                      : "";

                return (
                  <div className="bar-column" key={index}>
                    <div
                      className={`bar ${barClass}${value === undefined ? " bar-empty" : ""}`}
                      style={{
                        height: `${value === undefined ? 4 : Math.max(8, value)}%`,
                      }}
                      role="img"
                      aria-label={`Index ${index}, ${value === undefined ? "empty insertion position" : `value ${value}`}${sortedIndices.has(index) || isComplete ? ", sorted" : ""}${index === minimumIndex ? ", current minimum" : ""}${index === keyIndex ? ", insertion key held" : ""}${index === pivotIndex ? ", pivot" : ""}${index === partitionBoundary && inPartitionRange ? ", partition boundary" : ""}`}
                    >
                      {value !== undefined && <span>{value}</span>}
                    </div>
                    <span className="bar-index">{index}</span>
                  </div>
                );
              })}
            </div>

            <div className="legend">
              <span><i className="legend-default" /> Unsorted</span>
              <span><i className="legend-comparing" /> Comparing</span>
              <span><i className="legend-swapping" /> Swapping</span>
              {activeAlgorithm === "Insertion Sort" && (
                <>
                  <span><i className="legend-key" /> Insertion key</span>
                  <span><i className="legend-shifting" /> Shifting</span>
                </>
              )}
              {activeAlgorithm === "Merge Sort" && (
                <>
                  <span><i className="legend-dividing" /> Divide range</span>
                  <span><i className="legend-merging" /> Active merge</span>
                </>
              )}
              {activeAlgorithm === "Quick Sort" && (
                <>
                  <span><i className="legend-pivot" /> Pivot</span>
                  <span><i className="legend-boundary" /> Partition boundary</span>
                  <span><i className="legend-dividing" /> Active partition</span>
                </>
              )}
              <span><i className="legend-sorted" /> Sorted</span>
            </div>
          </div>

          <section className="sorting-execution" aria-label="Step-by-step execution">
            <div className="sorting-execution-heading">
              <div>
                <div className="eyebrow">STEP-BY-STEP EXECUTION</div>
                <h4>{activeAlgorithm}</h4>
              </div>
              <span className="sorting-step-counter" aria-live="polite">
                Step {step} of {sorting.events.length}
              </span>
            </div>
            <p className="sorting-step-explanation" aria-live="polite">
              {stepDetails.explanation}
            </p>
            <div className="sorting-execution-grid">
              <div className="sorting-pseudocode" aria-label={`${activeAlgorithm} pseudocode`}>
                {stepDetails.code.map((line, index) => (
                  <div
                    className={`sorting-code-line${stepDetails.activeCodeLine === line.id ? " active" : ""}`}
                    key={line.id}
                    aria-current={stepDetails.activeCodeLine === line.id ? "step" : undefined}
                  >
                    <span>{index + 1}</span>
                    <code>{line.text}</code>
                  </div>
                ))}
              </div>
              <dl className="sorting-state-readout">
                <div>
                  <dt>Array</dt>
                  <dd>[{currentValues.map((value) => value ?? "·").join(", ")}]</dd>
                </div>
                <div>
                  <dt>Active indexes</dt>
                  <dd>{activeIndices.length ? activeIndices.join(", ") : "—"}</dd>
                </div>
                <div>
                  <dt>Current minimum</dt>
                  <dd>{minimumIndex === undefined ? "—" : `index ${minimumIndex}`}</dd>
                </div>
                <div>
                  <dt>Insertion key</dt>
                  <dd>{heldKey === undefined ? "—" : `${heldKey} (index ${keyIndex})`}</dd>
                </div>
                <div>
                  <dt>Pivot</dt>
                  <dd>
                    {pivotValue === undefined
                      ? "—"
                      : pivotIndex === undefined
                        ? pivotValue
                        : `${pivotValue} (index ${pivotIndex})`}
                  </dd>
                </div>
                <div>
                  <dt>Comparisons · movements</dt>
                  <dd>{comparisons} · {movements}</dd>
                </div>
              </dl>
            </div>
          </section>

          <div className="playback">
            <div className="playback-buttons">
              <button
                className="icon-button"
                onClick={stepBackward}
                disabled={step === 0}
                aria-label="Step backward"
              >
                |◀
              </button>
              <button
                className="play-button"
                onClick={() => {
                  if (!isPlaying) {
                    void saveTopicProgress(
                      topicForSection("sorting"),
                      "in-progress",
                    );
                  }
                  setIsPlaying((playing) => !playing);
                }}
                disabled={!isPlaying && isComplete}
                aria-label={isPlaying ? "Pause animation" : "Play animation"}
              >
                {isPlaying ? "Ⅱ" : "▶"}
              </button>
              <button
                className="icon-button"
                onClick={stepForward}
                disabled={isComplete}
                aria-label="Step forward"
              >
                ▶|
              </button>
            </div>
            <div className="progress-section">
              <div className="progress-label">
                <span>Visualization progress</span>
                <span aria-live="polite">
                  {isComplete
                    ? "Complete"
                    : step === 0
                      ? "Ready to begin"
                      : `Step ${step} of ${sorting.events.length}`}
                </span>
              </div>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Visualization progress"
                aria-valuemin={0}
                aria-valuemax={sorting.events.length}
                aria-valuenow={step}
              >
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="step-count">
              STEP {step} / {sorting.events.length}
            </span>
            <label className="playback-speed" htmlFor="sorting-playback-speed">
              Speed
              <select
                id="sorting-playback-speed"
                value={playbackDelay}
                onChange={(event) => setPlaybackDelay(Number(event.target.value))}
              >
                <option value={900}>0.5×</option>
                <option value={450}>1×</option>
                <option value={225}>2×</option>
              </select>
            </label>
          </div>
        </section>

        <section className="info-grid">
          <article className="info-card">
            <span className="info-icon violet">⌘</span>
            <div>
              <span className="info-label">COMPARISONS</span>
              <strong>{comparisons}</strong>
              <p>Element comparisons</p>
            </div>
          </article>
          <article className="info-card">
            <span className="info-icon cyan">⇄</span>
            <div>
              <span className="info-label">
                {activeAlgorithm === "Insertion Sort" ||
                activeAlgorithm === "Merge Sort"
                  ? "MOVEMENTS"
                  : "SWAPS"}
              </span>
              <strong>
                {activeAlgorithm === "Insertion Sort" ||
                activeAlgorithm === "Merge Sort"
                  ? movements
                  : swaps}
              </strong>
              <p>
                {activeAlgorithm === "Insertion Sort"
                  ? "Shifts and key writes"
                  : activeAlgorithm === "Merge Sort"
                    ? "Values written during merges"
                    : "Positions exchanged"}
              </p>
            </div>
          </article>
          <article className="info-card">
            <span className="info-icon amber">◷</span>
            <div>
              <span className="info-label">COMPLEXITY</span>
              <strong>
                {activeAlgorithm === "Merge Sort"
                    ? "O(n log n)"
                    : activeAlgorithm === "Quick Sort"
                      ? "O(n²) worst"
                      : "O(n²)"}
              </strong>
              <p>
                {activeAlgorithm === "Merge Sort"
                    ? "Best, average & worst case"
                    : activeAlgorithm === "Quick Sort"
                      ? "Best/average O(n log n) · worst O(n²)"
                      : activeAlgorithm === "Selection Sort"
                        ? "Best, average & worst case"
                        : "Best O(n) · average/worst O(n²)"}
              </p>
            </div>
          </article>
        </section>

        <footer className="footer">
          <span>ALGOCANVAS <span className="footer-separator">/</span> BUILT TO UNDERSTAND</span>
          <span>More than code. A way to see it.</span>
        </footer>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
