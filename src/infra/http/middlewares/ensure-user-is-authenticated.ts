import type { Request, Response, NextFunction } from "express";
import { authGateway } from "../../auth/better-auth-gateway";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      sub: string;
      role?: string;
    };
  }
}

/**
 * Valida a sessão via better-auth (cookie de web ou `Authorization: Bearer`
 * nativo). A leitura é sempre autoritativa (sem cookie cache), então logout,
 * expiração e revogação valem imediatamente.
 */
export async function ensureUserIsAuthenticated(
  request: Request,
  reply: Response,
  next: NextFunction,
) {
  try {
    const session = await authGateway.getSession(request.headers);

    if (!session) {
      return reply
        .status(401)
        .json({ message: "Sessão inválida ou expirada." });
    }

    request.user = {
      sub: session.user.id,
      role: session.user.role,
    };

    next();
  } catch (error) {
    console.error("[ensureUserIsAuthenticated] Error:", error);
    return reply.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}
