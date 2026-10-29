import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";

export function createApiJsonParser(): RequestHandler {
  return express.json({
    limit: "16kb",
    type: (req) => {
      const contentType = req.headers["content-type"];
      const mediaType =
        typeof contentType === "string"
          ? contentType.split(";")[0]?.trim().toLowerCase()
          : undefined;
      const isJson =
        mediaType === "application/json" ||
        (mediaType?.startsWith("application/") === true &&
          mediaType.endsWith("+json"));
      return (
        !/^\/api\/code-execution(?:\/|$)/.test(req.url ?? "") &&
        isJson
      );
    },
  });
}

export function createProfilePhotoBodyParser(): [
  RequestHandler,
  ErrorRequestHandler,
] {
  return [
    express.raw({ type: () => true, limit: 5 * 1024 * 1024 }),
    (error, _req, res, next) => {
      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 413
      ) {
        res.status(413).json({ message: "Profile photos must be 5 MB or smaller." });
        return;
      }
      next(error);
    },
  ];
}
