export interface CreateUserResponse {
  userId: string;
  /** Cookies de sessão a repassar ao cliente (cadastro já inicia a sessão). */
  setCookies: string[];
  authToken?: string;
}
