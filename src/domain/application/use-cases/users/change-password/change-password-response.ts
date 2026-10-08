export interface ChangePasswordResponse {
  status: true;
  message: string;
  /** Cookies de sessão atualizados a repassar ao cliente web. */
  setCookies: string[];
  authToken?: string;
}
