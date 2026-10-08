import type { RequestHeaders } from "../../../gateways/auth-gateway";

export interface SignOutDTO {
  headers?: RequestHeaders;
  /** true encerra todas as sessões do usuário (logout-all). */
  all?: boolean;
}
