import { randomUUID } from "node:crypto";
import type {
  AuthGateway,
  AuthRelay,
  AuthSession,
  AuthenticatedAuthSession,
  RequestHeaders,
  SignInAuthInput,
  SignUpAuthInput,
} from "../../src/domain/application/gateways/auth-gateway";
import { AuthGatewayError } from "../../src/domain/application/gateways/auth-gateway";
import type { UsersRepository } from "../../src/domain/application/repositories/users-repository";
import { User } from "../../src/domain/enterprise/entities/user";
import { sessionExpiresAtForRole } from "../../src/infra/auth/session-expiry";

interface StoredReset {
  token: string;
  userId: string;
  redirectTo?: string;
}

/**
 * Implementação em memória do AuthGateway (better-auth) para testes de
 * unidade: mesma semântica de erros/expiração, sem rede nem banco.
 */
export class FakeAuthGateway implements AuthGateway {
  private credentials = new Map<string, string>();
  private sessions = new Map<string, AuthSession>();
  private emailVerificationTokens = new Map<string, string>();
  private passwordResets: StoredReset[] = [];

  /** Total de sessões ativas (para asserções de revogação). */
  get activeSessionCount(): number {
    return this.sessions.size;
  }

  /** Tokens de redefinição ainda válidos (para asserções de invalidação). */
  get pendingPasswordResetCount(): number {
    return this.passwordResets.length;
  }

  constructor(private usersRepository: UsersRepository) {}

  /** Permite semear credenciais sem passar pelo cadastro. */
  registerCredentials(email: string, password: string): void {
    this.credentials.set(email.trim().toLowerCase(), password);
  }

  /** Simula a passagem do tempo para tokens/sessões expirados. */
  expireSession(token: string): void {
    const session = this.sessions.get(token);
    if (session) {
      session.expiresAt = new Date(Date.now() - 1000);
    }
  }

  /** Deixa uma sessão válida prestes a expirar (para testar o refresh). */
  shrinkSession(token: string, ttlSeconds = 60): void {
    const session = this.sessions.get(token);
    if (session) {
      session.expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    }
  }

  async signUp(
    input: SignUpAuthInput,
  ): Promise<{ userId: string } & AuthRelay> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.usersRepository.findByCpfOrEmail(
      input.cpf,
      email,
    );

    if (existing) {
      throw new AuthGatewayError("EMAIL_ALREADY_IN_USE");
    }

    if (input.password.length < 8) {
      throw new AuthGatewayError("WEAK_PASSWORD", "Senha muito fraca.");
    }

    const user = User.create({
      name: input.name,
      email,
      cpf: input.cpf,
      phoneNumber: input.phoneNumber,
      role: "CLIENT",
    });

    await this.usersRepository.save(user);
    this.credentials.set(email, input.password);

    const token = randomUUID();

    return {
      userId: user.id.toString(),
      setCookies: [`better-auth.session_token=${token}; Path=/`],
      authToken: token,
    };
  }

  async signIn(input: SignInAuthInput): Promise<AuthenticatedAuthSession> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);
    const password = this.credentials.get(email);

    if (!user || !password || password !== input.password) {
      throw new AuthGatewayError(
        "INVALID_CREDENTIALS",
        "E-mail ou senha incorretos.",
      );
    }

    const token = randomUUID();
    const session: AuthSession = {
      token,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        cpf: user.cpf,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      expiresAt: sessionExpiresAtForRole(user.role),
    };

    this.sessions.set(token, session);

    return {
      ...session,
      setCookies: [`better-auth.session_token=${token}; Path=/`],
      authToken: token,
    };
  }

  async getSession(
    headers: RequestHeaders,
  ): Promise<AuthenticatedAuthSession | null> {
    const token = this.extractToken(headers);

    if (!token) return null;

    const session = this.sessions.get(token);

    if (!session) return null;

    if (session.expiresAt.getTime() <= Date.now()) {
      this.sessions.delete(token);
      return null;
    }

    return {
      ...session,
      setCookies: [],
      authToken: token,
    };
  }

  async refreshSession(input: {
    headers?: RequestHeaders;
    token?: string;
  }): Promise<AuthenticatedAuthSession | null> {
    const headers: RequestHeaders = input.token
      ? { authorization: `Bearer ${input.token}` }
      : (input.headers ?? {});

    const current = await this.getSession(headers);

    if (!current) return null;

    const extended: AuthSession = {
      ...current,
      expiresAt: sessionExpiresAtForRole(current.user.role),
    };

    this.sessions.set(current.token, extended);

    return { ...extended, setCookies: [], authToken: current.token };
  }

  async signOut(headers: RequestHeaders): Promise<AuthRelay> {
    const token = this.extractToken(headers);

    if (token) {
      this.sessions.delete(token);
    }

    return { setCookies: ["better-auth.session_token=; Path=/; Max-Age=0"] };
  }

  async revokeAllSessions(headers: RequestHeaders): Promise<void> {
    const current = await this.getSession(headers);

    if (!current) {
      throw new AuthGatewayError("UNAUTHORIZED");
    }

    for (const [token, session] of this.sessions) {
      if (session.user.id === current.user.id) {
        this.sessions.delete(token);
      }
    }
  }

  async requestEmailVerification(input: {
    email: string;
    callbackURL?: string;
  }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);

    if (user && !user.emailVerified) {
      const token = randomUUID();
      this.emailVerificationTokens.set(token, email);
    }

    // Resposta genérica, exista ou não a conta.
  }

  async confirmEmailVerification(input: {
    token: string;
    callbackURL?: string;
  }): Promise<{ status: true }> {
    const email = this.emailVerificationTokens.get(input.token);

    if (!email) {
      throw new AuthGatewayError("INVALID_TOKEN", "Token inválido.");
    }

    this.emailVerificationTokens.delete(input.token);

    const user = await this.usersRepository.findByEmail(email);

    if (user) {
      user.markEmailAsVerified();
      await this.usersRepository.save(user);
    }

    return { status: true };
  }

  async requestPasswordReset(input: {
    email: string;
    redirectTo?: string;
  }): Promise<void> {
    const email = input.email.trim().toLowerCase();
    const user = await this.usersRepository.findByEmail(email);

    if (!user) return;

    // Apenas o link mais recente permanece válido.
    this.passwordResets = this.passwordResets.filter(
      (reset) => reset.userId !== user.id.toString(),
    );

    this.passwordResets.push({
      token: randomUUID(),
      userId: user.id.toString(),
      redirectTo: input.redirectTo,
    });
  }

  async confirmPasswordReset(input: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    const reset = this.passwordResets.find(
      (candidate) => candidate.token === input.token,
    );

    if (!reset) {
      throw new AuthGatewayError("INVALID_TOKEN", "Token inválido.");
    }

    const user = await this.usersRepository.findById(reset.userId);

    if (!user) {
      throw new AuthGatewayError("INVALID_TOKEN", "Token inválido.");
    }

    this.credentials.set(user.email, input.newPassword);
    this.passwordResets = this.passwordResets.filter(
      (candidate) => candidate.token !== input.token,
    );

    // Revoga todas as sessões do usuário.
    for (const [token, session] of this.sessions) {
      if (session.user.id === reset.userId) {
        this.sessions.delete(token);
      }
    }
  }

  async changePassword(input: {
    headers: RequestHeaders;
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthRelay> {
    const current = await this.getSession(input.headers);

    if (!current) {
      throw new AuthGatewayError("UNAUTHORIZED", "Sessão inválida.");
    }

    const storedPassword = this.credentials.get(current.user.email);

    if (storedPassword !== input.currentPassword) {
      throw new AuthGatewayError("INVALID_PASSWORD", "Senha atual incorreta.");
    }

    if (input.newPassword.length < 8) {
      throw new AuthGatewayError("WEAK_PASSWORD", "Senha muito fraca.");
    }

    this.credentials.set(current.user.email, input.newPassword);

    // Revoga as demais sessões e links de recuperação pendentes.
    for (const [token, session] of this.sessions) {
      if (session.user.id === current.user.id && token !== current.token) {
        this.sessions.delete(token);
      }
    }

    this.passwordResets = this.passwordResets.filter(
      (reset) => reset.userId !== current.user.id,
    );

    return { setCookies: [] };
  }

  private extractToken(headers: RequestHeaders): string | undefined {
    const authorization = headers.authorization;

    if (typeof authorization === "string" && authorization) {
      return authorization.replace(/^Bearer\s+/i, "");
    }

    const cookie = headers.cookie;

    if (typeof cookie === "string" && cookie) {
      const match = cookie.match(/better-auth\.session_token=([^;]+)/);
      return match?.[1];
    }

    return undefined;
  }
}
