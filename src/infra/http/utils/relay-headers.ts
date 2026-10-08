import type { AuthRelay } from "../../../domain/application/gateways/auth-gateway";

/**
 * Converte o relay de sessão do better-auth em cabeçalhos HTTP da resposta:
 * `Set-Cookie` (web) e `set-auth-token` (rotação de token para o app nativo).
 */
export function relayHeaders(
  relay: Pick<AuthRelay, "setCookies"> & { authToken?: string },
): Record<string, string | string[]> {
  const headers: Record<string, string | string[]> = {};

  if (relay.setCookies.length > 0) {
    headers["set-cookie"] = relay.setCookies;
  }

  if (relay.authToken) {
    headers["set-auth-token"] = relay.authToken;
  }

  return headers;
}
