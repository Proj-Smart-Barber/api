import type { Request, Response, NextFunction } from "express";
import { authGateway } from "../../auth/better-auth-gateway";

/**
 * Anexa `request.user` quando existe uma sessão válida; sem sessão o request
 * segue anônimo (convidado), sem bloquear a rota.
 */
export async function optionalUserAuthentication(
  request: Request,
  _reply: Response,
  next: NextFunction,
) {
  try {
    const session = await authGateway.getSession(request.headers);

    if (session) {
      request.user = {
        sub: session.user.id,
        role: session.user.role,
      };
    }
  } catch {
    // Sessão ausente/inválida → continua como convidado.
  }

  return next();
}
