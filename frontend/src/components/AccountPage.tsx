import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  checkUsernameAvailability,
  deleteAccount,
  exportAccountData,
  getAccountProfile,
  getLearningProgress,
  removeProfileAvatar,
  updateAccountProfile,
  uploadProfileAvatar,
  type AccountPreferences,
  type AccountProfile,
  type AuthUser,
  type LearningProgressRecord,
  type LearningLevel,
  type ProfileLanguage,
} from "../api/client";
import "./AccountPage.css";

type AccountPageName = "profile" | "settings";

interface AccountPageProps {
  page: AccountPageName;
  user: AuthUser;
  isAuthBusy: boolean;
  onNavigate: (page: AccountPageName | "learn") => void;
  onUserUpdate: (user: AuthUser) => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
}

const defaultPreferences: AccountPreferences = {
  preferredLanguage: "cpp",
  learningLevel: "beginner",
  editorFontSize: 13,
};
const maxPhotoSize = 5 * 1024 * 1024;
const allowedPhotoTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function AccountAvatar({
  profile,
  preview,
  className = "",
}: {
  profile: AccountProfile;
  preview?: string;
  className?: string;
}) {
  const image = preview ?? profile.avatar;
  return image ? (
    <img className={`account-avatar ${className}`} src={image} alt="" />
  ) : (
    <span className={`account-avatar account-avatar-fallback ${className}`}>
      {(profile.displayName || profile.name).slice(0, 1).toUpperCase()}
    </span>
  );
}

function AccountPage({
  page,
  user,
  isAuthBusy,
  onNavigate,
  onUserUpdate,
  onLogout,
  onAccountDeleted,
}: AccountPageProps) {
  const [profile, setProfile] = useState<AccountProfile>();
  const [progress, setProgress] = useState<LearningProgressRecord[]>([]);
  const [loadError, setLoadError] = useState("");
  const [progressError, setProgressError] = useState("");
  const [loadedPage, setLoadedPage] = useState<AccountPageName | null>(null);
  const isLoading = loadedPage !== page;
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [usernameState, setUsernameState] = useState<
    "idle" | "checking" | "available" | "taken" | "error"
  >("idle");
  const [photo, setPhoto] = useState<File>();
  const [photoPreview, setPhotoPreview] = useState("");
  const [removePhoto, setRemovePhoto] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const photoPreviewRef = useRef("");

  const completedCount = useMemo(
    () => progress.filter((record) => record.status === "completed").length,
    [progress],
  );
  const inProgressCount = useMemo(
    () => progress.filter((record) => record.status === "in-progress").length,
    [progress],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      getAccountProfile(),
      page === "profile"
        ? getLearningProgress()
            .then((records) => {
              if (active) setProgressError("");
              return records;
            })
            .catch((cause: unknown) => {
              if (active) {
                setProgressError(
                  getErrorMessage(cause, "Could not load learning activity."),
                );
              }
              return [];
            })
        : Promise.resolve([]),
    ])
      .then(([savedProfile, savedProgress]) => {
        if (!active) return;
        setProfile(savedProfile);
        setProgress(savedProgress);
        setName(savedProfile.name);
        setUsername(savedProfile.username);
        setDisplayName(savedProfile.displayName);
        setBio(savedProfile.bio);
        setPreferences(savedProfile.preferences);
        setLoadError("");
      })
      .catch((cause: unknown) => {
        if (active) setLoadError(getErrorMessage(cause, "Could not load your account."));
      })
      .finally(() => {
        if (active) setLoadedPage(page);
      });
    return () => {
      active = false;
    };
  }, [page]);

  useEffect(
    () => () => {
      if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    },
    [],
  );

  function selectPhoto(file?: File) {
    if (photoPreviewRef.current) URL.revokeObjectURL(photoPreviewRef.current);
    photoPreviewRef.current = file ? URL.createObjectURL(file) : "";
    setPhotoPreview(photoPreviewRef.current);
    setPhoto(file);
  }

  function applyProfile(savedProfile: AccountProfile) {
    setProfile(savedProfile);
    onUserUpdate({
      ...user,
      name: savedProfile.name,
      username: savedProfile.username,
      displayName: savedProfile.displayName,
      avatar: savedProfile.avatar,
      preferences: savedProfile.preferences,
    });
  }

  async function checkUsername(value = username): Promise<boolean | undefined> {
    const normalized = value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      setUsernameState("idle");
      return false;
    }
    if (normalized === profile?.username) {
      setUsernameState("available");
      return true;
    }
    setUsernameState("checking");
    try {
      const available = await checkUsernameAvailability(normalized);
      setUsernameState(available ? "available" : "taken");
      return available;
    } catch (cause) {
      setUsernameState("error");
      setError(getErrorMessage(cause, "Could not check username availability."));
      return undefined;
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!allowedPhotoTypes.has(file.type)) {
      setError("Choose a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > maxPhotoSize) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }
    setError("");
    setNotice("");
    setRemovePhoto(false);
    selectPhoto(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || isSaving) return;
    setError("");
    setNotice("");
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
      setError("Username must be 3–24 characters using lowercase letters, numbers, or underscores.");
      return;
    }
    if (normalizedUsername !== profile.username) {
      const available = await checkUsername(normalizedUsername);
      if (available !== true) {
        if (available === false) setError("That username is already taken.");
        return;
      }
    }
    if (name.trim().length === 0) {
      setError("Full name is required.");
      return;
    }
    setIsSaving(true);
    try {
      let savedProfile = await updateAccountProfile({
        name,
        username: normalizedUsername,
        displayName,
        bio,
        ...preferences,
      });
      applyProfile(savedProfile);
      if (photo) {
        try {
          savedProfile = await uploadProfileAvatar(photo);
        } catch (cause) {
          applyProfile(savedProfile);
          setError(`Your profile was saved, but the photo could not be uploaded: ${getErrorMessage(cause, "Upload failed.")}`);
          return;
        }
      } else if (removePhoto && profile.hasCustomAvatar) {
        savedProfile = await removeProfileAvatar();
      }
      applyProfile(savedProfile);
      selectPhoto();
      setRemovePhoto(false);
      setIsEditing(false);
      setNotice("Profile changes saved.");
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not save your profile."));
    } finally {
      setIsSaving(false);
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || isSaving) return;
    setIsSaving(true);
    setError("");
    setNotice("");
    try {
      const savedProfile = await updateAccountProfile({
        name: profile.name,
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio,
        ...preferences,
      });
      applyProfile(savedProfile);
      setNotice("Learning preferences saved.");
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not save your learning preferences."));
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadExport() {
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const blob = await exportAccountData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "algocanvas-account-export.json";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice("Your account export has been downloaded.");
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not export your account data."));
    } finally {
      setExporting(false);
    }
  }

  async function confirmDeleteAccount() {
    if (deleteConfirmation !== "DELETE" || isDeleting) return;
    setIsDeleting(true);
    setError("");
    try {
      await deleteAccount();
      onAccountDeleted();
    } catch (cause) {
      setError(getErrorMessage(cause, "Could not delete your account."));
      setIsDeleting(false);
    }
  }

  return (
    <div className="account-page-content">
      <header className="account-page-heading">
        <div>
          <div className="breadcrumb">Account / {page === "profile" ? "Profile" : "Settings"}</div>
          <h1>{page === "profile" ? "Your profile" : "Account settings"}</h1>
          <p>
            {page === "profile"
              ? "Your learning identity, progress, and account details."
              : "Make AlgoCanvas feel right for the way you learn."}
          </p>
        </div>
        <nav className="account-page-tabs" aria-label="Account pages">
          <button
            type="button"
            className={page === "profile" ? "active" : ""}
            aria-current={page === "profile" ? "page" : undefined}
            onClick={() => onNavigate("profile")}
          >
            Profile
          </button>
          <button
            type="button"
            className={page === "settings" ? "active" : ""}
            aria-current={page === "settings" ? "page" : undefined}
            onClick={() => onNavigate("settings")}
          >
            Settings
          </button>
        </nav>
      </header>

      {loadError && !isLoading && (
        <div className="account-alert error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => window.location.reload()}>Reload account</button>
        </div>
      )}
      {error && <div className="account-alert error" role="alert">{error}</div>}
      {notice && <div className="account-alert success" role="status">{notice}</div>}

      {isLoading ? (
        <section className="account-state-card" aria-live="polite">
          <span className="loading-spinner" />
          <span>Loading your account…</span>
        </section>
      ) : profile ? page === "profile" ? (
        <>
          <section className="account-profile-hero">
            <div className="account-profile-identity">
              <AccountAvatar profile={profile} className="account-avatar-large" />
              <div>
                <span className="account-eyebrow">ALGO CANVAS LEARNER</span>
                <h2>{profile.displayName || profile.name}</h2>
                <p>@{profile.username || "username not set"} <span>·</span> {profile.email}</p>
              </div>
            </div>
            <button
              className="account-primary-button"
              type="button"
              onClick={() => {
                if (isEditing) {
                  setName(profile.name);
                  setUsername(profile.username);
                  setDisplayName(profile.displayName);
                  setBio(profile.bio);
                  setPreferences(profile.preferences);
                  selectPhoto();
                  setRemovePhoto(false);
                }
                setIsEditing((current) => !current);
                setError("");
                setNotice("");
              }}
            >
              {isEditing ? "Cancel editing" : "Edit profile"}
            </button>
          </section>

          {isEditing && (
            <form className="account-card account-form" onSubmit={(event) => void saveProfile(event)}>
              <div className="account-section-heading">
                <div>
                  <span className="account-eyebrow">PROFILE DETAILS</span>
                  <h2>Make it yours</h2>
                </div>
                <span className="account-private-note">Email is managed by Google</span>
              </div>
              <div className="account-photo-field">
                <AccountAvatar
                  profile={profile}
                  preview={removePhoto ? undefined : photoPreview || undefined}
                  className="account-avatar-edit"
                />
                <div>
                  <strong>Profile photo</strong>
                  <p>JPEG, PNG, WebP, or GIF · up to 5 MB</p>
                  <div className="account-inline-actions">
                    <label className="account-secondary-button">
                      {profile.hasCustomAvatar ? "Replace photo" : "Upload photo"}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handlePhotoChange} />
                    </label>
                    {(profile.hasCustomAvatar || photo) && (
                      <button
                        type="button"
                        className="account-text-button"
                        onClick={() => {
                          selectPhoto();
                          setRemovePhoto(profile.hasCustomAvatar);
                        }}
                      >
                        {profile.hasCustomAvatar ? "Use Google photo" : "Remove selected photo"}
                      </button>
                    )}
                  </div>
                  {photo && <span className="account-photo-filename">{photo.name} · preview</span>}
                  {removePhoto && <span className="account-photo-filename">Google account photo will be restored when saved.</span>}
                </div>
              </div>
              <div className="account-form-grid">
                <label>
                  Full name
                  <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required />
                </label>
                <label>
                  Username
                  <input
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value.toLowerCase());
                      setUsernameState("idle");
                    }}
                    onBlur={() => void checkUsername()}
                    minLength={3}
                    maxLength={24}
                    pattern="[a-z0-9_]{3,24}"
                    autoComplete="username"
                    required
                    aria-describedby="account-username-help"
                  />
                  <span id="account-username-help" className={`account-field-hint ${usernameState}`}>
                    {usernameState === "checking" ? "Checking availability…" :
                      usernameState === "available" ? "Username is available." :
                        usernameState === "taken" ? "That username is already taken." :
                          usernameState === "error" ? "Availability could not be checked." :
                            "3–24 lowercase letters, numbers, or underscores."}
                  </span>
                </label>
                <label>
                  Display name <span className="account-optional">optional</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} placeholder="What should we call you?" />
                </label>
                <label className="account-field-wide">
                  About you <span className="account-optional">optional</span>
                  <textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={280} rows={4} placeholder="A little about what you're learning…" />
                  <span className="account-character-count">{bio.length}/280</span>
                </label>
              </div>
              <div className="account-form-actions">
                <button className="account-primary-button" type="submit" disabled={isSaving}>
                  {isSaving ? "Saving…" : "Save profile"}
                </button>
                <button
                  className="account-secondary-button"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    selectPhoto();
                    setRemovePhoto(false);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="account-profile-grid">
            <section className="account-card account-progress-card">
              <div className="account-section-heading">
                <div>
                  <span className="account-eyebrow">LEARNING ACTIVITY</span>
                  <h2>Your progress</h2>
                </div>
                <button className="account-text-button" type="button" onClick={() => onNavigate("learn")}>Open Learn →</button>
              </div>
              <div className="account-stat-grid">
                <div><strong>{completedCount}</strong><span>Topics completed</span></div>
                <div><strong>{inProgressCount}</strong><span>In progress</span></div>
                <div><strong>{progress.length}</strong><span>Topics visited</span></div>
              </div>
              {progress.length === 0 ? (
                <p className="account-empty-note">
                  {progressError || "Your learning activity will appear here as you explore AlgoCanvas."}
                </p>
              ) : (
                <ul className="account-activity-list">
                  {progress.slice(0, 4).map((record) => (
                    <li key={record.topicId}>
                      <span className={`account-activity-indicator ${record.status}`} />
                      <span>{record.topicName}</span>
                      <small>{record.status === "completed" ? "Completed" : "In progress"}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="account-card account-details-card">
              <div className="account-section-heading">
                <div>
                  <span className="account-eyebrow">ACCOUNT DETAILS</span>
                  <h2>About your account</h2>
                </div>
              </div>
              <dl>
                <div><dt>Email address</dt><dd>{profile.email}</dd></div>
                <div><dt>Username</dt><dd>{profile.username ? `@${profile.username}` : "Not set"}</dd></div>
                <div><dt>Member since</dt><dd>{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(profile.createdAt))}</dd></div>
                <div><dt>Sign-in method</dt><dd>Google</dd></div>
                <div><dt>About</dt><dd>{profile.bio || "Add a short bio to tell others about your learning journey."}</dd></div>
              </dl>
            </section>
          </div>
        </>
      ) : (
        <div className="account-settings-layout">
          <section className="account-card">
            <div className="account-section-heading">
              <div>
                <span className="account-eyebrow">APPEARANCE</span>
                <h2>Obsidian Studio</h2>
              </div>
              <span className="account-theme-badge"><i /> Dark</span>
            </div>
            <p className="account-description">The current AlgoCanvas design is built around the Obsidian Studio dark theme. Light mode is not available in this theme system yet.</p>
          </section>

          <form className="account-card account-form" onSubmit={(event) => void savePreferences(event)}>
            <div className="account-section-heading">
              <div>
                <span className="account-eyebrow">LEARNING PREFERENCES</span>
                <h2>Your learning setup</h2>
              </div>
            </div>
            <div className="account-form-grid">
              <label>
                Preferred programming language
                <select
                  value={preferences.preferredLanguage}
                  onChange={(event) => setPreferences((current) => ({ ...current, preferredLanguage: event.target.value as ProfileLanguage }))}
                >
                  <option value="cpp">C++</option><option value="c">C</option><option value="python">Python</option><option value="java">Java</option>
                </select>
              </label>
              <label>
                Learning level
                <select
                  value={preferences.learningLevel}
                  onChange={(event) => setPreferences((current) => ({ ...current, learningLevel: event.target.value as LearningLevel }))}
                >
                  <option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option>
                </select>
              </label>
              <label>
                Editor font size <span className="account-size-value">{preferences.editorFontSize}px</span>
                <input
                  type="range"
                  min={10}
                  max={24}
                  step={1}
                  value={preferences.editorFontSize}
                  onChange={(event) => setPreferences((current) => ({ ...current, editorFontSize: Number(event.target.value) }))}
                />
                <span className="account-field-hint">Applied to the Code Playground editor.</span>
              </label>
            </div>
            <div className="account-form-actions">
              <button className="account-primary-button" type="submit" disabled={isSaving}>
                {isSaving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </form>

          <section className="account-card">
            <div className="account-section-heading">
              <div>
                <span className="account-eyebrow">PRIVACY &amp; SECURITY</span>
                <h2>Sign-in and session</h2>
              </div>
            </div>
            <div className="account-security-list">
              <div><span>Signed-in email</span><strong>{profile.email}</strong></div>
              <div><span>Authentication method</span><strong>Google sign-in</strong></div>
              <div><span>Session</span><strong>7-day server-verified session (HttpOnly cookie)</strong></div>
            </div>
            <p className="account-description">Session tokens and secrets are never displayed here.</p>
            <button className="account-secondary-button" type="button" onClick={onLogout} disabled={isAuthBusy}>Sign out securely</button>
          </section>

          <section className="account-card">
            <div className="account-section-heading">
              <div>
                <span className="account-eyebrow">NOTIFICATIONS</span>
                <h2>Learning reminders</h2>
              </div>
            </div>
            <p className="account-description">AlgoCanvas does not currently send learning reminders or activity notifications. No notification preferences are stored.</p>
          </section>

          <section className="account-card account-management-card">
            <div className="account-section-heading">
              <div>
                <span className="account-eyebrow">ACCOUNT MANAGEMENT</span>
                <h2>Your data and account</h2>
              </div>
            </div>
            <div className="account-management-row">
              <div><strong>Export your data</strong><p>Download your profile, learning progress, and learning goal as JSON.</p></div>
              <button className="account-secondary-button" type="button" onClick={() => void downloadExport()} disabled={exporting}>{exporting ? "Preparing…" : "Download JSON"}</button>
            </div>
            <div className="account-management-row account-danger-row">
              <div><strong>Delete account</strong><p>Permanently delete your profile, photo, learning progress, and learning goal.</p></div>
              <button className="account-danger-button" type="button" onClick={() => setShowDeleteDialog(true)}>Delete account</button>
            </div>
          </section>
        </div>
      ) : null}

      {showDeleteDialog && (
        <div className="account-dialog-backdrop" role="presentation">
          <section className="account-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="account-delete-title">
            <span className="account-eyebrow">PERMANENT ACTION</span>
            <h2 id="account-delete-title">Delete your account?</h2>
            <p>This permanently deletes your account, profile photo, learning progress, and learning goal. This action cannot be undone.</p>
            <label>
              Type <strong>DELETE</strong> to confirm
              <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoFocus />
            </label>
            <div className="account-form-actions">
              <button className="account-danger-button" type="button" disabled={deleteConfirmation !== "DELETE" || isDeleting} onClick={() => void confirmDeleteAccount()}>
                {isDeleting ? "Deleting…" : "Permanently delete"}
              </button>
              <button className="account-secondary-button" type="button" disabled={isDeleting} onClick={() => { setShowDeleteDialog(false); setDeleteConfirmation(""); }}>
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default AccountPage;
