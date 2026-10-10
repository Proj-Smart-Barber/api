import type { Request, Response, NextFunction } from "express";
import { JsonWebTokenError, TokenExpiredError, verify } from "jsonwebtoken";
import { DrizzleUsersRepository } from "../../drizzle/repositories/drizzle-users-repository";
import { env } from "../../env";

interface Payload {
  sub: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: Payload;
  }
}

export async function ensureUserIsAuthenticated(
  request: Request,
  reply: Response,
  next: NextFunction,
) {
  const authHeader = request.headers.authorization;

  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return reply.status(401).json({ message: "Token is missing!" });
  }

  try {
    const payload = verify(token, env.JWT_SECRET) as Payload;
    const usersRepository = new DrizzleUsersRepository();

    const user = await usersRepository.findById(payload.sub);

    if (!user) {
      return reply.status(401).json({ message: "Usuário não encontrado." });
    }

    request.user = payload;
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return reply.status(401).json({ error: "token_expired" });
    }

    if (error instanceof JsonWebTokenError) {
      return reply.status(401).json({ error: "invalid_token" });
    }

    console.error("[ensureUserIsAuthenticated] Error:", error);
    return reply.status(500).json({ error });
  }
}
