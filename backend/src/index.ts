
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import { createAuthRouter } from "./routes/auth.js";
import {
  createLearningGoalRouter,
  createLearningProgressRouter,
} from "./routes/learningProgress.js";
import { createCodeExecutionRouter } from "./routes/codeExecution.js";
import { createProfileRouter } from "./routes/profile.js";
import {
  createApiJsonParser,
  createProfilePhotoBodyParser,
} from "./requestBodyParsing.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

function getAllowedOrigins(): Set<string> {
  const configuredOrigins =
    process.env.FRONTEND_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? [];

  if (isProduction && configuredOrigins.length === 0) {
    throw new Error("FRONTEND_ORIGINS must be configured in production.");
  }

  const origins = new Set(
    isProduction
      ? configuredOrigins
      : ["http://localhost:5173", "http://127.0.0.1:5173", ...configuredOrigins],
  );

  for (const origin of origins) {
    let parsedOrigin: URL;
    try {
      parsedOrigin = new URL(origin);
    } catch {
      throw new Error("FRONTEND_ORIGINS must contain valid HTTP or HTTPS origins.");
    }
    if (
      (isProduction ? parsedOrigin.protocol !== "https:" : !["http:", "https:"].includes(parsedOrigin.protocol)) ||
      parsedOrigin.origin !== origin
    ) {
      throw new Error("FRONTEND_ORIGINS must contain valid HTTP or HTTPS origins.");
    }
  }

  return origins;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim() && Buffer.byteLength(secret, "utf8") >= 32) {
    return secret;
  }

  if (isProduction) {
    throw new Error("SESSION_SECRET must be set to at least 32 bytes in production.");
  }

  if (secret) {
    throw new Error("SESSION_SECRET must be set to at least 32 bytes.");
  }

  console.warn(
    "SESSION_SECRET is unset; using a temporary development-only session key.",
  );
  return randomBytes(32).toString("base64url");
}

function getCookieSameSite(): "lax" | "strict" | "none" {
  const sameSite = process.env.SESSION_COOKIE_SAME_SITE?.toLowerCase() ?? "lax";
  if (!["lax", "strict", "none"].includes(sameSite)) {
    throw new Error("SESSION_COOKIE_SAME_SITE must be lax, strict, or none.");
  }
  if (sameSite === "none" && !isProduction) {
    throw new Error("SESSION_COOKIE_SAME_SITE=none requires production HTTPS.");
  }
  return sameSite as "lax" | "strict" | "none";
}

const allowedOrigins = getAllowedOrigins();

app.use(
  cors({
    origin(origin, callback) {
      callback(null, origin ? allowedOrigins.has(origin) : false);
    },
    credentials: true,
  }),
);
app.use(createApiJsonParser());
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.json({
    message: "AlgoCanvas backend is running!",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "OK",
    message: "AlgoCanvas API is healthy",
  });
});

function getMongoUri(): string {
  const mongoUri = process.env.MONGODB_URI?.trim();
  if (!mongoUri) {
    throw new Error(
      "MONGODB_URI is missing. Add your MongoDB connection string to backend/.env.",
    );
  }

  try {
    new mongoose.mongo.MongoClient(mongoUri);
  } catch {
    throw new Error(
      "MONGODB_URI is invalid. It must be a valid mongodb:// or mongodb+srv:// connection string.",
    );
  }

  return mongoUri;
}

async function startServer() {
  let sessionSecret: string;
  let sameSite: "lax" | "strict" | "none";
  try {
    sessionSecret = getSessionSecret();
    sameSite = getCookieSameSite();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "Session configuration is invalid.",
    );
    process.exitCode = 1;
    return;
  }

  let mongoUri: string;
  try {
    mongoUri = getMongoUri();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "MONGODB_URI is invalid. Check the backend environment configuration.",
    );
    process.exitCode = 1;
    return;
  }

  try {
    await mongoose.connect(mongoUri);
  } catch {
    console.error(
      "Could not connect to MongoDB. Check MONGODB_URI, Atlas network access, and database credentials. The connection string was not logged.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("Connected to MongoDB.");

  app.use(
    "/api/auth",
    createAuthRouter({
      allowedOrigins,
      googleClientId: process.env.GOOGLE_CLIENT_ID?.trim(),
      isProduction,
      sameSite,
      sessionSecret,
    }),
  );
  app.use(
    "/api/profile/avatar",
    ...createProfilePhotoBodyParser(),
  );
  app.use(
    "/api/profile",
    createProfileRouter({
      allowedOrigins,
      sessionSecret,
      isProduction,
      sameSite,
    }),
  );
  app.use(
    "/api/learning-progress",
    createLearningProgressRouter({ allowedOrigins, sessionSecret }),
  );
  app.use(
    "/api/learning-goal",
    createLearningGoalRouter({ allowedOrigins, sessionSecret }),
  );
  app.use(
    "/api/code-execution",
    express.json({ limit: "256kb" }),
    createCodeExecutionRouter({ allowedOrigins }),
  );

  const server = app.listen(PORT, () => {
    console.log(`AlgoCanvas backend running on port ${PORT}`);
  });
  let isShuttingDown = false;

  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`${signal} received. Closing server and MongoDB connection.`);

    server.close((error) => {
      if (error) {
        console.error("Could not close the HTTP server cleanly.");
        process.exitCode = 1;
      }

      void mongoose
        .disconnect()
        .then(() => console.log("MongoDB connection closed."))
        .catch(() => {
          console.error("Could not close the MongoDB connection cleanly.");
          process.exitCode = 1;
        });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer();
