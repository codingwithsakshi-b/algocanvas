import { Router, type Request, type Response, type NextFunction } from "express";
import mongoose, { type QueryFilter } from "mongoose";
import LearningProgress, {
  type LearningProgress as LearningProgressRecord,
  type LearningProgressCategory,
  type LearningProgressStatus,
} from "../models/LearningProgress.js";
import LearningGoal from "../models/LearningGoal.js";
import { validateLearningGoalInput } from "../learningGoalValidation.js";
import User from "../models/User.js";
import { SESSION_COOKIE, verifySessionUserId } from "./session.js";

const categories: LearningProgressCategory[] = [
  "sorting",
  "data-structures",
  "graphs",
];
const statuses: LearningProgressStatus[] = [
  "not-started",
  "in-progress",
  "completed",
];

interface AuthenticatedRequest extends Request {
  authenticatedUserId: string;
}

interface LearningProgressRouterOptions {
  allowedOrigins: Set<string>;
  sessionSecret: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

async function requireSession(
  options: LearningProgressRouterOptions,
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
    console.error(
      "Could not verify the learning progress session.",
      safeErrorMetadata(error),
    );
    res.status(500).json({ message: "Could not verify the session." });
    return;
  }

  (req as AuthenticatedRequest).authenticatedUserId = userId;
  next();
}

function getAuthenticatedUserId(req: Request): string {
  return (req as AuthenticatedRequest).authenticatedUserId;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

export function createLearningProgressRouter(
  options: LearningProgressRouterOptions,
): Router {
  const router = Router();
  const authenticate = (req: Request, res: Response, next: NextFunction) =>
    requireSession(options, req, res, next);

  router.get("/", authenticate, async (req, res) => {
    try {
      const progress = await LearningProgress.find({
        userId: getAuthenticatedUserId(req),
      })
        .select(
          "topicId topicName category status lastVisitedAt completedAt createdAt updatedAt",
        )
        .sort({ updatedAt: -1 })
        .lean();
      res.json({ progress });
    } catch (error) {
      console.error(
        "Could not load learning progress.",
        safeErrorMetadata(error),
      );
      res.status(500).json({ message: "Could not load learning progress." });
    }
  });

  router.put("/:topicId", authenticate, async (req, res) => {
    const { topicId } = req.params;
    const body: unknown = req.body;
    if (
      typeof topicId !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topicId) ||
      topicId.length > 80
    ) {
      res.status(400).json({ message: "A valid topic ID is required." });
      return;
    }
    if (!isRecord(body)) {
      res.status(400).json({ message: "A valid progress payload is required." });
      return;
    }

    const { topicName, category, status } = body;
    if (
      typeof topicName !== "string" ||
      topicName.trim().length === 0 ||
      topicName.trim().length > 100
    ) {
      res.status(400).json({ message: "Topic name must be between 1 and 100 characters." });
      return;
    }
    const validCategory =
      typeof category === "string"
        ? categories.find((candidate) => candidate === category)
        : undefined;
    if (!validCategory) {
      res.status(400).json({ message: "Topic category is invalid." });
      return;
    }
    const validStatus =
      typeof status === "string"
        ? statuses.find((candidate) => candidate === status)
        : undefined;
    if (!validStatus) {
      res.status(400).json({ message: "Progress status is invalid." });
      return;
    }

    const userId = getAuthenticatedUserId(req);
    const now = new Date();
    const update = {
      $set: {
        topicName: topicName.trim(),
        category: validCategory,
        status: validStatus,
        lastVisitedAt: now,
        ...(validStatus === "completed" ? { completedAt: now } : {}),
      },
      ...(validStatus === "completed" ? {} : { $unset: { completedAt: 1 } }),
    };
    const userTopicFilter = {
      userId: new mongoose.Types.ObjectId(userId),
      topicId,
    };
    const filter: QueryFilter<LearningProgressRecord> = {
      ...userTopicFilter,
      status: { $ne: "completed" },
    };
    const fields =
      "topicId topicName category status lastVisitedAt completedAt createdAt updatedAt";

    try {
      let progress;
      try {
        progress = await LearningProgress.findOneAndUpdate(filter, update, {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }).select(fields);
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        progress = await LearningProgress.findOneAndUpdate(
          filter,
          update,
          { new: true, runValidators: true },
        ).select(fields);
        if (!progress) {
          progress = await LearningProgress.findOne(userTopicFilter)
            .select(fields);
          if (!progress) throw error;
          if (validStatus !== "completed" && progress.status === "completed") {
            progress =
              (await LearningProgress.findOneAndUpdate(
                { ...userTopicFilter, status: "completed" },
                {
                  $set: {
                    topicName: topicName.trim(),
                    category: validCategory,
                    lastVisitedAt: now,
                  },
                },
                { new: true, runValidators: true },
              ).select(fields)) ?? progress;
          }
        }
      }

      if (!progress) {
        res.status(500).json({ message: "Could not save learning progress." });
        return;
      }
      res.json({ progress });
    } catch (error) {
      console.error(
        "Could not save learning progress.",
        safeErrorMetadata(error),
      );
      res.status(500).json({ message: "Could not save learning progress." });
    }
  });

  return router;
}

export function createLearningGoalRouter(
  options: LearningProgressRouterOptions,
): Router {
  const router = Router();
  const authenticate = (req: Request, res: Response, next: NextFunction) =>
    requireSession(options, req, res, next);

  router.get("/", authenticate, async (req, res) => {
    try {
      const goal = await LearningGoal.findOne({
        userId: getAuthenticatedUserId(req),
      })
        .select("targetTopics durationDays startedAt deadlineAt createdAt updatedAt")
        .lean();
      res.json({ goal });
    } catch (error) {
      console.error("Could not load learning goal.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not load learning goal." });
    }
  });

  router.put("/", authenticate, async (req, res) => {
    const validation = validateLearningGoalInput(req.body);
    if (!validation.valid) {
      res.status(400).json({ message: validation.message });
      return;
    }

    const userId = getAuthenticatedUserId(req);
    const now = new Date();
    const { targetTopics, durationDays } = validation.value;
    const filter = { userId: new mongoose.Types.ObjectId(userId) };
    const update = {
      $set: {
        targetTopics,
        durationDays,
        startedAt: now,
        deadlineAt: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000),
      },
    };

    try {
      let goal;
      try {
        goal = await LearningGoal.findOneAndUpdate(filter, update, {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }).select("targetTopics durationDays startedAt deadlineAt createdAt updatedAt");
      } catch (error) {
        if (isDuplicateKeyError(error)) {
          goal = await LearningGoal.findOneAndUpdate(filter, update, {
            new: true,
            runValidators: true,
          }).select("targetTopics durationDays startedAt deadlineAt createdAt updatedAt");
          if (!goal) throw error;
        } else {
          throw error;
        }
      }

      if (!goal) {
        res.status(500).json({ message: "Could not save learning goal." });
        return;
      }
      res.json({ goal });
    } catch (error) {
      console.error("Could not save learning goal.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not save learning goal." });
    }
  });

  router.delete("/", authenticate, async (req, res) => {
    try {
      await LearningGoal.deleteOne({
        userId: new mongoose.Types.ObjectId(getAuthenticatedUserId(req)),
      });
      res.status(204).end();
    } catch (error) {
      console.error("Could not delete learning goal.", safeErrorMetadata(error));
      res.status(500).json({ message: "Could not delete learning goal." });
    }
  });

  return router;
}
