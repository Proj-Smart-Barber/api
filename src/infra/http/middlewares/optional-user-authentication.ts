import type { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { env } from "../../env";

interface Payload {
  sub: string;
}

export async function optionalUserAuthentication(
  request: Request,
  _reply: Response,
  next: NextFunction,
) {
  const authHeader = request.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return next();
  }

  try {
    const payload = verify(token, env.JWT_SECRET) as Payload;
    request.user = payload;
  } catch {
    // If token is invalid or expired, continue as anonymous/guest
  }

  return next();
}
