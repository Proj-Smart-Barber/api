import type { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { DrizzleStaffsRepository } from "../../drizzle/repositories/drizzle-staffs-repository";
import { env } from "../../env";

interface Payload {
  sub: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: Payload;
  }
}

export async function ensureStaffIsAuthenticated(
  request: Request,
  reply: Response,
  next: NextFunction,
) {
  const authHeader = request.headers["authorization"];

  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return reply.status(401).json({ message: "Token is missing!" });
  }

  try {
    const payload = verify(token, env.JWT_SECRET) as Payload;
    const staffsRepository = new DrizzleStaffsRepository();

    console.log(payload);

    const staff = await staffsRepository.findById(payload.sub);

    if (!staff) {
      return reply.status(401).json({ message: "Usuário não encontrado." });
    }

    request.user = payload;
    next();
  } catch (error) {
    return reply.status(500).json({ error });
  }
}
