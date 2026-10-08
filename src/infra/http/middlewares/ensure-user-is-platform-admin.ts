import type { Request, Response, NextFunction } from "express";
import { authGateway } from "../../auth/better-auth-gateway";

/**
 * Protege a manutenção HTTP do sistema: exige sessão ativa de
 * PLATFORM_ADMIN (leitura autoritativa, sem cache).
 */
export async function ensureUserIsPlatformAdmin(
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

    if (session.user.role !== "PLATFORM_ADMIN") {
      return reply
        .status(403)
        .json({ message: "Acesso restrito a administradores da plataforma." });
    }

    request.user = {
      sub: session.user.id,
      role: session.user.role,
    };

    next();
  } catch (error) {
    console.error("[ensureUserIsPlatformAdmin] Error:", error);
    return reply.status(401).json({ message: "Sessão inválida ou expirada." });
  }
}
