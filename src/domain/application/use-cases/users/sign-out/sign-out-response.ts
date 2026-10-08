export interface SignOutResponse {
  status: true;
  /** Cookies expirados a repassar ao cliente web. */
  setCookies: string[];
  authToken?: string;
}
