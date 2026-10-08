/**
 * Contrato entre os use-cases de autenticação e a implementação de
 * infraestrutura (better-auth). Mantém os controllers/use-cases livres de
 * detalhes de cookies, headers e SDK — e as unit tests livres de rede/banco.
 */

export type UserRole = "CLIENT" | "BARBER" | "OWNER" | "PLATFORM_ADMIN";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cpf: string;
  phoneNumber?: string;
  avatarUrl?: string;
  emailVerified: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: Date;
}

export interface AuthRelay {
  /** Cabeçalhos Set-Cookie a serem repassados ao cliente (fluxo web). */
  setCookies: string[];
  /** Cabeçalho `set-auth-token` (rotação de token para clientes nativos). */
  authToken?: string;
}

export type AuthenticatedAuthSession = AuthSession & AuthRelay;

export type AuthGatewayErrorCode =
  | "EMAIL_ALREADY_IN_USE"
  | "CPF_ALREADY_IN_USE"
  | "INVALID_CREDENTIALS"
  | "UNAUTHORIZED"
  | "INVALID_TOKEN"
  | "INVALID_PASSWORD"
  | "WEAK_PASSWORD"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class AuthGatewayError extends Error {
  constructor(
    readonly code: AuthGatewayErrorCode,
    message?: string,
    options?: { cause?: unknown },
  ) {
    super(message ?? code, options);
    this.name = "AuthGatewayError";
  }
}

export interface SignUpAuthInput {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phoneNumber?: string;
  /** URL de retorno após confirmação de e-mail (web ou deep link). */
  callbackURL?: string;
}

export interface SignInAuthInput {
  email: string;
  password: string;
  callbackURL?: string;
}

export interface RequestHeaders {
  [key: string]: string | string[] | undefined;
}

export interface AuthGateway {
  signUp(input: SignUpAuthInput): Promise<{ userId: string } & AuthRelay>;
  signIn(input: SignInAuthInput): Promise<AuthenticatedAuthSession>;
  getSession(headers: RequestHeaders): Promise<AuthenticatedAuthSession | null>;
  refreshSession(input: {
    headers?: RequestHeaders;
    token?: string;
  }): Promise<AuthenticatedAuthSession | null>;
  signOut(headers: RequestHeaders): Promise<AuthRelay>;
  revokeAllSessions(headers: RequestHeaders): Promise<void>;
  requestEmailVerification(input: {
    email: string;
    callbackURL?: string;
  }): Promise<void>;
  confirmEmailVerification(input: {
    token: string;
    callbackURL?: string;
  }): Promise<{ status: true }>;
  requestPasswordReset(input: {
    email: string;
    redirectTo?: string;
  }): Promise<void>;
  confirmPasswordReset(input: {
    token: string;
    newPassword: string;
  }): Promise<void>;
  changePassword(input: {
    headers: RequestHeaders;
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthRelay>;
}
