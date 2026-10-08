import type { UserRole } from "../../domain/application/gateways/auth-gateway";

/**
 * Política de expiração de sessão (issue #32):
 * - OWNER e PLATFORM_ADMIN ("gestores"): 8 horas;
 * - CLIENT e BARBER ("usuários"): 30 dias.
 *
 * A expiração é aplicada na criação da sessão (databaseHooks.session.create)
 * e em cada refresh explícito — o refresh automático do better-auth fica
 * desabilitado (`session.disableSessionRefresh`) para que a janela de 8h do
 * gestor nunca seja estendida silenciosamente para 30 dias.
 */
export const GESTOR_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const USER_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

const GESTOR_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  "OWNER",
  "PLATFORM_ADMIN",
]);

export function isGestorRole(role: UserRole): boolean {
  return GESTOR_ROLES.has(role);
}

export function sessionTtlSecondsForRole(role: UserRole): number {
  return isGestorRole(role)
    ? GESTOR_SESSION_TTL_SECONDS
    : USER_SESSION_TTL_SECONDS;
}

export function sessionExpiresAtForRole(
  role: UserRole,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() + sessionTtlSecondsForRole(role) * 1000);
}
