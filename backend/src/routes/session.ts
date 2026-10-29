import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export const SESSION_COOKIE = "algocanvas_session";
const SESSION_ISSUER = "algocanvas";
const SESSION_AUDIENCE = "algocanvas-web";

export function verifySessionUserId(
  token: string,
  secret: string,
): string | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: SESSION_ISSUER,
      audience: SESSION_AUDIENCE,
    });
    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      !mongoose.isValidObjectId(decoded.sub)
    ) {
      return null;
    }
    return decoded.sub;
  } catch {
    return null;
  }
}
