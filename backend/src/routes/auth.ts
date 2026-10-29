import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User, { type User as UserRecord } from "../models/User.js";
import { SESSION_COOKIE, verifySessionUserId } from "./session.js";

const googleAuthClient = new OAuth2Client();
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_ISSUER = "algocanvas";
const SESSION_AUDIENCE = "algocanvas-web";

interface AuthRouterOptions {
  allowedOrigins: Set<string>;
  googleClientId: string | undefined;
  isProduction: boolean;
  sameSite: "lax" | "strict" | "none";
  sessionSecret: string;
}

function hasTrustedOrigin(
  req: Request,
  res: Response,
  allowedOrigins: Set<string>,
): boolean {
  const origin = req.get("origin");
  if (!origin || !allowedOrigins.has(origin)) {
    res.status(403).json({ message: "Request origin is not allowed." });
    return false;
  }
  return true;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

class GoogleAccountConflictError extends Error {}

function fingerprintAudience(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function logGoogleAudienceDiagnostic(
  tokenAudience: unknown,
  configuredAudience: string | undefined,
): void {
  const configuredAudienceNonEmpty =
    configuredAudience !== undefined && configuredAudience.length > 0;
  const configuredAudienceFingerprint = configuredAudienceNonEmpty
    ? fingerprintAudience(configuredAudience)
    : null;
  const tokenAudienceFingerprints =
    typeof tokenAudience === "string"
      ? [fingerprintAudience(tokenAudience)]
      : Array.isArray(tokenAudience)
        ? tokenAudience
            .filter((claim): claim is string => typeof claim === "string")
            .map(fingerprintAudience)
        : [];

  console.error("Google token audience diagnostic.", {
    renderServiceIdPresent: Boolean(process.env.RENDER_SERVICE_ID),
    renderGitCommitPresent: Boolean(process.env.RENDER_GIT_COMMIT),
    renderInstanceIdPresent: Boolean(process.env.RENDER_INSTANCE_ID),
    configuredAudienceNonEmpty,
    configuredAudienceFingerprint,
    tokenAudienceFingerprints,
    audienceFingerprintsMatch:
      configuredAudienceFingerprint !== null &&
      tokenAudienceFingerprints.includes(configuredAudienceFingerprint),
  });
}

async function findMatchingUser(profile: {
  googleId: string;
  email: string;
}) {
  const [googleUser, emailUser] = await Promise.all([
    User.findOne({ googleId: profile.googleId }),
    User.findOne({ email: profile.email }),
  ]);

  if (
    googleUser &&
    emailUser &&
    !googleUser._id.equals(emailUser._id)
  ) {
    throw new GoogleAccountConflictError();
  }
  if (emailUser?.googleId && emailUser.googleId !== profile.googleId) {
    throw new GoogleAccountConflictError();
  }

  return googleUser ?? emailUser;
}

function safeDatabaseErrorMetadata(error: unknown) {
  const metadata: { name: string; code?: string | number } = {
    name: error instanceof Error ? error.name : "UnknownError",
  };
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (typeof error.code === "string" || typeof error.code === "number")
  ) {
    metadata.code = error.code;
  }
  return metadata;
}

function setUserProfile(
  user: mongoose.HydratedDocument<UserRecord>,
  profile: {
    googleId: string;
    name: string;
    email: string;
    avatar?: string;
  },
): void {
  user.googleId = profile.googleId;
  if (!user.name) user.name = profile.name;
  user.email = profile.email;
  user.set("avatar", profile.avatar);
}

function safeUserProfile(user: {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  avatar?: string;
  username?: string;
  displayName?: string;
  customAvatarId?: mongoose.Types.ObjectId;
  preferredLanguage?: UserRecord["preferredLanguage"];
  learningLevel?: UserRecord["learningLevel"];
  editorFontSize?: number;
}) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    ...(user.username ? { username: user.username } : {}),
    ...(user.displayName ? { displayName: user.displayName } : {}),
    ...(user.customAvatarId
      ? { avatar: `/api/profile/avatar?v=${user.customAvatarId.toString()}` }
      : user.avatar
        ? { avatar: user.avatar }
        : {}),
    preferences: {
      preferredLanguage: user.preferredLanguage ?? "cpp",
      learningLevel: user.learningLevel ?? "beginner",
      editorFontSize: user.editorFontSize ?? 13,
    },
  };
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();

  router.post("/google", async (req, res) => {
    if (!hasTrustedOrigin(req, res, options.allowedOrigins)) return;
    if (!options.googleClientId) {
      res.status(503).json({ message: "Google sign-in is not configured." });
      return;
    }

    const body: unknown = req.body;
    const tokenCandidate =
      typeof body === "object" && body !== null
        ? "idToken" in body
          ? body.idToken
          : "credential" in body
            ? body.credential
            : undefined
        : undefined;
    if (
      typeof tokenCandidate !== "string" ||
      tokenCandidate.length === 0 ||
      tokenCandidate.length > 16_384
    ) {
      res.status(400).json({ message: "A valid Google ID token is required." });
      return;
    }

    let payload;
    try {
      const ticket = await googleAuthClient.verifyIdToken({
        idToken: tokenCandidate,
        audience: options.googleClientId,
      });
      payload = ticket.getPayload();
    } catch {
      try {
        const decoded = jwt.decode(tokenCandidate);
        const tokenAudience =
          typeof decoded === "object" && decoded !== null
            ? decoded.aud
            : undefined;
        logGoogleAudienceDiagnostic(tokenAudience, options.googleClientId);
      } catch {
        logGoogleAudienceDiagnostic(undefined, options.googleClientId);
      }
      res.status(401).json({ message: "Google ID token is invalid or expired." });
      return;
    }

    const googleId = payload?.sub;
    const name = payload?.name?.trim();
    const email = payload?.email?.trim().toLowerCase();
    if (!googleId || !name || !email || payload?.email_verified !== true) {
      res.status(401).json({ message: "Google ID token does not contain a verified profile." });
      return;
    }

    const profile = {
      googleId,
      name,
      email,
      ...(payload.picture ? { avatar: payload.picture } : {}),
    };

    let user;
    try {
      user = await findMatchingUser(profile);
      if (user) {
        setUserProfile(user, profile);
        await user.save();
      } else {
        try {
          user = await User.create(profile);
        } catch (error) {
          if (!isDuplicateKeyError(error)) throw error;
          user = await findMatchingUser(profile);
          if (!user) throw error;
          setUserProfile(user, profile);
          await user.save();
        }
      }
    } catch (error) {
      if (error instanceof GoogleAccountConflictError) {
        res.status(409).json({
          message: "This Google account conflicts with an existing account.",
        });
        return;
      }
      console.error(
        "Google sign-in user persistence failed.",
        safeDatabaseErrorMetadata(error),
      );
      res.status(500).json({ message: "Google sign-in could not be completed." });
      return;
    }

    const sessionToken = jwt.sign({}, options.sessionSecret, {
      algorithm: "HS256",
      subject: user._id.toString(),
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
      expiresIn: "7d",
    });

    res.cookie(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: options.isProduction,
      sameSite: options.sameSite,
      maxAge: SESSION_MAX_AGE_MS,
      path: "/",
    });
    res.json({ user: safeUserProfile(user) });
  });

  router.get("/me", async (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string") {
      res.status(401).json({ message: "Authentication is required." });
      return;
    }

    const subject = verifySessionUserId(token, options.sessionSecret);
    if (!subject) {
      res.status(401).json({ message: "Session is invalid or expired." });
      return;
    }

    const user = await User.findById(subject).select(
      "name email avatar username displayName customAvatarId preferredLanguage learningLevel editorFontSize",
    );
    if (!user) {
      res.status(401).json({ message: "Session is invalid or expired." });
      return;
    }
    res.json({ user: safeUserProfile(user) });
  });

  router.post("/logout", (req, res) => {
    if (!hasTrustedOrigin(req, res, options.allowedOrigins)) return;
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      secure: options.isProduction,
      sameSite: options.sameSite,
      path: "/",
    });
    res.status(204).end();
  });

  return router;
}
