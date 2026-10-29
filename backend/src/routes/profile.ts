import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose from "mongoose";
import { Readable } from "node:stream";
import LearningGoal from "../models/LearningGoal.js";
import LearningProgress from "../models/LearningProgress.js";
import User, { type User as UserRecord } from "../models/User.js";
import { validateProfileUpdate } from "../profileValidation.js";
import { SESSION_COOKIE, verifySessionUserId } from "./session.js";

interface AuthenticatedRequest extends Request {
  authenticatedUserId: string;
}

interface ProfileRouterOptions {
  allowedOrigins: Set<string>;
  sessionSecret: string;
  isProduction: boolean;
  sameSite: "lax" | "strict" | "none";
}

const maxAvatarBytes = 5 * 1024 * 1024;
const allowedAvatarTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function safeErrorMetadata(error: unknown) {
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

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB is not connected.");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "profilePhotos" });
}

function isValidImage(bytes: Buffer, contentType: string): boolean {
  if (contentType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/gif") {
    const signature = bytes.subarray(0, 6).toString("ascii");
    return signature === "GIF87a" || signature === "GIF89a";
  }
  if (contentType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}

function profileResponse(user: mongoose.HydratedDocument<UserRecord>) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    username: user.username ?? "",
    displayName: user.displayName ?? "",
    bio: user.bio ?? "",
    avatar: user.customAvatarId
      ? `/api/profile/avatar?v=${user.customAvatarId.toString()}`
      : user.avatar ?? "",
    hasCustomAvatar: Boolean(user.customAvatarId),
    createdAt: user.createdAt.toISOString(),
    authMethod: "Google",
    preferences: {
      preferredLanguage: user.preferredLanguage ?? "cpp",
      learningLevel: user.learningLevel ?? "beginner",
      editorFontSize: user.editorFontSize ?? 13,
    },
  };
}

async function requireSession(
  options: ProfileRouterOptions,
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.method !== "GET") {
    const origin = req.get("origin");
    if (!origin || !options.allowedOrigins.has(origin)) {
      res.status(403).json({ message: "Request origin is not allowed." });
      return;
    }
  }

  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") {
    res.status(401).json({ message: "Authentication is required." });
    return;
  }
  const userId = verifySessionUserId(token, options.sessionSecret);
  if (!userId) {
    res.status(401).json({ message: "Session is invalid or expired." });
    return;
  }

  try {
    if (!(await User.exists({ _id: userId }))) {
      res.status(401).json({ message: "Session is invalid or expired." });
      return;
    }
  } catch (error) {
    console.error("Could not verify the profile session.", safeErrorMetadata(error));
    res.status(500).json({ message: "Could not verify the session." });
    return;
  }
  (req as AuthenticatedRequest).authenticatedUserId = userId;
  next();
}

function getAuthenticatedUserId(req: Request): string {
  return (req as AuthenticatedRequest).authenticatedUserId;
}

export function createProfileRouter(options: ProfileRouterOptions): Router {
  const router = Router();
  const authenticate = (req: Request, res: Response, next: NextFunction) =>
    requireSession(options, req, res, next);

  router.get("/", authenticate, async (req, res) => {
    try {
      const user = await User.findById(getAuthenticatedUserId(req));
      if (!user) {
        res.status(401).json({ message: "Session is invalid or expired." });
        return;
      }
      res.json({ profile: profileResponse(user) });
    } catch (error) {
      console.error("Could not load the profile.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not load your profile." });
    }
  });

  router.get("/username-availability", authenticate, async (req, res) => {
    const username =
      typeof req.query.username === "string"
        ? req.query.username.trim().toLowerCase()
        : "";
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      res.status(400).json({ message: "A valid username is required." });
      return;
    }
    try {
      const existing = await User.findOne({ username })
        .select("_id")
        .lean();
      res.json({
        available:
          !existing || existing._id.toString() === getAuthenticatedUserId(req),
      });
    } catch (error) {
      console.error(
        "Could not check username availability.",
        safeErrorMetadata(error),
      );
      res.status(500).json({ message: "Could not check username availability." });
    }
  });

  router.put("/", authenticate, async (req, res) => {
    const result = validateProfileUpdate(req.body);
    if ("error" in result) {
      res.status(400).json({ message: result.error });
      return;
    }
    try {
      const user = await User.findById(getAuthenticatedUserId(req));
      if (!user) {
        res.status(401).json({ message: "Session is invalid or expired." });
        return;
      }
      Object.assign(user, result.update);
      await user.save();
      res.json({ profile: profileResponse(user) });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({ message: "That username is already taken." });
        return;
      }
      console.error("Could not update the profile.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not update your profile." });
    }
  });

  router.get("/avatar", authenticate, async (req, res) => {
    try {
      const user = await User.findById(getAuthenticatedUserId(req)).select(
        "customAvatarId",
      );
      if (!user?.customAvatarId) {
        res.status(404).end();
        return;
      }
      res.setHeader("Cache-Control", "private, max-age=3600");
      const stream = getBucket().openDownloadStream(user.customAvatarId);
      stream.on("file", (file) => {
        const contentType = file.metadata?.contentType;
        if (typeof contentType === "string" && allowedAvatarTypes.has(contentType)) {
          res.setHeader("Content-Type", contentType);
        }
      });
      stream.on("error", (error) => {
        if (!res.headersSent) res.status(404).end();
        console.error("Could not read the profile photo.", safeErrorMetadata(error));
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Could not load the profile photo.", safeErrorMetadata(error));
      if (!res.headersSent) {
        res.status(500).json({ message: "Could not load the profile photo." });
      }
    }
  });

  router.post(
    "/avatar",
    authenticate,
    (req, res, next) => {
      const contentType = req.get("content-type")?.split(";")[0]?.trim();
      if (!contentType || !allowedAvatarTypes.has(contentType)) {
        res.status(415).json({ message: "Choose a JPEG, PNG, WebP, or GIF image." });
        return;
      }
      next();
    },
    async (req, res) => {
      const contentType = req.get("content-type")?.split(";")[0]?.trim() ?? "";
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (bytes.length === 0 || bytes.length > maxAvatarBytes) {
        res.status(400).json({ message: "Profile photos must be between 1 byte and 5 MB." });
        return;
      }
      if (!isValidImage(bytes, contentType)) {
        res.status(400).json({ message: "The selected file is not a valid image." });
        return;
      }
      let uploadedId: mongoose.Types.ObjectId | undefined;
      try {
        const bucket = getBucket();
        const upload = bucket.openUploadStream("profile-photo", {
          metadata: { ownerId: getAuthenticatedUserId(req), contentType },
        });
        uploadedId = upload.id;
        await new Promise<void>((resolve, reject) => {
          upload.once("error", reject);
          upload.once("finish", resolve);
          Readable.from(bytes).pipe(upload);
        });

        const user = await User.findById(getAuthenticatedUserId(req));
        if (!user) {
          await bucket.delete(uploadedId);
          res.status(401).json({ message: "Session is invalid or expired." });
          return;
        }
        const previousAvatarId = user.customAvatarId;
        user.customAvatarId = uploadedId;
        await user.save();
        if (previousAvatarId) {
          try {
            await bucket.delete(previousAvatarId);
          } catch (error) {
            console.error(
              "Could not remove the previous profile photo.",
              safeErrorMetadata(error),
            );
          }
        }
        res.json({ profile: profileResponse(user) });
      } catch (error) {
        if (uploadedId) {
          try {
            await getBucket().delete(uploadedId);
          } catch (cleanupError) {
            console.error(
              "Could not clean up an incomplete profile photo upload.",
              safeErrorMetadata(cleanupError),
            );
          }
        }
        console.error("Could not save the profile photo.", safeErrorMetadata(error));
        res.status(500).json({ message: "Could not save the profile photo." });
      }
    },
  );

  router.delete("/avatar", authenticate, async (req, res) => {
    try {
      const user = await User.findById(getAuthenticatedUserId(req));
      if (!user) {
        res.status(401).json({ message: "Session is invalid or expired." });
        return;
      }
      const previousAvatarId = user.customAvatarId;
      user.set("customAvatarId", undefined);
      await user.save();
      if (previousAvatarId) {
        try {
          await getBucket().delete(previousAvatarId);
        } catch (error) {
          console.error("Could not remove the profile photo.", safeErrorMetadata(error));
        }
      }
      res.json({ profile: profileResponse(user) });
    } catch (error) {
      console.error("Could not remove the profile photo.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not remove the profile photo." });
    }
  });

  router.get("/export", authenticate, async (req, res) => {
    try {
      const user = await User.findById(getAuthenticatedUserId(req)).select(
        "-googleId -__v",
      );
      if (!user) {
        res.status(401).json({ message: "Session is invalid or expired." });
        return;
      }
      const [progress, goal] = await Promise.all([
        LearningProgress.find({ userId: user._id })
          .select("topicId topicName category status lastVisitedAt completedAt createdAt updatedAt")
          .lean(),
        LearningGoal.findOne({ userId: user._id })
          .select("targetTopics durationDays startedAt deadlineAt createdAt updatedAt")
          .lean(),
      ]);
      res.json({
        exportedAt: new Date().toISOString(),
        profile: profileResponse(user),
        learningProgress: progress,
        learningGoal: goal,
      });
    } catch (error) {
      console.error("Could not export account data.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not export account data." });
    }
  });

  router.delete("/account", authenticate, async (req, res) => {
    if (
      typeof req.body !== "object" ||
      req.body === null ||
      req.body.confirmation !== "DELETE"
    ) {
      res.status(400).json({ message: 'Type "DELETE" to confirm account deletion.' });
      return;
    }
    const userId = getAuthenticatedUserId(req);
    const session = await mongoose.startSession();
    let customAvatarId: mongoose.Types.ObjectId | undefined;
    try {
      await session.withTransaction(async () => {
        const user = await User.findById(userId).session(session);
        if (!user) throw new Error("Account no longer exists.");
        customAvatarId = user.customAvatarId;
        await LearningProgress.deleteMany({ userId }, { session });
        await LearningGoal.deleteOne({ userId }, { session });
        await User.deleteOne({ _id: userId }, { session });
      });
    } catch (error) {
      console.error("Could not delete the account.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not delete the account." });
      return;
    } finally {
      await session.endSession();
    }

    if (customAvatarId) {
      try {
        await getBucket().delete(customAvatarId);
      } catch (error) {
        console.error("Could not remove the deleted account's profile photo.", safeErrorMetadata(error));
      }
    }
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
