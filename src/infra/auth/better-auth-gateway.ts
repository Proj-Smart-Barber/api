import { createHash } from "node:crypto";
import { eq, and, like, lt } from "drizzle-orm";
import type {
  AuthGateway,
  AuthRelay,
  AuthSession,
  AuthenticatedAuthSession,
  AuthUser,
  RequestHeaders,
  SignInAuthInput,
  SignUpAuthInput,
  UserRole,
} from "../../domain/application/gateways/auth-gateway";
import { AuthGatewayError } from "../../domain/application/gateways/auth-gateway";
import { db } from "../drizzle";
import {
  session as sessionTable,
  users,
  verification,
} from "../drizzle/schema";
import { auth } from "./auth";
import { sessionExpiresAtForRole } from "./session-expiry";

type BetterAuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
} & Record<string, unknown>;

function toWebHeaders(headers: RequestHeaders): Headers {
  const result = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) result.append(key, item);
    } else {
      result.set(key, value);
    }
  }

  return result;
}

function collectRelay(headers: Headers): AuthRelay {
  const getSetCookie = (
    headers as Headers & { getSetCookie?: () => string[] }
  ).getSetCookie?.();

  const setCookies =
    getSetCookie && getSetCookie.length > 0
      ? getSetCookie
      : headers.get("set-cookie")
        ? [headers.get("set-cookie") as string]
        : [];

  const authToken = headers.get("set-auth-token") ?? undefined;

  return { setCookies, authToken };
}

function mapUser(user: BetterAuthUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role ?? "CLIENT") as UserRole,
    cpf: String(user.cpf ?? ""),
    phoneNumber:
      typeof user.phoneNumber === "string" ? user.phoneNumber : undefined,
    avatarUrl: typeof user.image === "string" ? user.image : undefined,
    emailVerified: Boolean(user.emailVerified),
  };
}

function statusOf(error: unknown): number | undefined {
  const candidate = error as { statusCode?: unknown; status?: unknown };
  if (typeof candidate?.statusCode === "number") return candidate.statusCode;
  return undefined;
}

function codeOf(error: unknown): string {
  const candidate = error as { body?: { code?: unknown }; code?: unknown };
  const code = candidate?.body?.code ?? candidate?.code;
  return typeof code === "string" ? code : "";
}

function messageOf(error: unknown): string {
  const candidate = error as {
    body?: { message?: unknown };
    message?: unknown;
  };
  const message = candidate?.body?.message ?? candidate?.message;
  return typeof message === "string" ? message : String(error);
}

function toGatewayError(
  error: unknown,
  fallback: "signIn" | "general",
): AuthGatewayError {
  if (error instanceof AuthGatewayError) return error;

  const statusCode = statusOf(error);
  const code = codeOf(error);
  const message = messageOf(error);

  if (code === "INVALID_EMAIL_OR_PASSWORD" || code === "INVALID_EMAIL") {
    return new AuthGatewayError("INVALID_CREDENTIALS", message, {
      cause: error,
    });
  }

  if (code.includes("TOKEN") || code === "INVALID_TOKEN") {
    return new AuthGatewayError("INVALID_TOKEN", message, { cause: error });
  }

  if (code.includes("PASSWORD_TOO") || code === "INVALID_PASSWORD") {
    return new AuthGatewayError(
      code.includes("TOO") ? "WEAK_PASSWORD" : "INVALID_PASSWORD",
      message,
      { cause: error },
    );
  }

  if (code === "TOO_MANY_REQUESTS" || statusCode === 429) {
    return new AuthGatewayError("RATE_LIMITED", message, { cause: error });
  }

  if (statusCode === 401) {
    return new AuthGatewayError(
      fallback === "signIn" ? "INVALID_CREDENTIALS" : "UNAUTHORIZED",
      message,
      { cause: error },
    );
  }

  if (statusCode === 403 || statusCode === 400) {
    return new AuthGatewayError("UNAUTHORIZED", message, { cause: error });
  }

  if (statusCode === 409) {
    return new AuthGatewayError("EMAIL_ALREADY_IN_USE", message, {
      cause: error,
    });
  }

  return new AuthGatewayError("UNKNOWN", message, { cause: error });
}

async function deletePendingPasswordResets(userId: string): Promise<void> {
  await db
    .delete(verification)
    .where(
      and(
        eq(verification.value, userId),
        like(verification.identifier, "reset-password:%"),
      ),
    );
}

/**
 * Implementação do AuthGateway sobre o better-auth.
 *
 * Todas as chamadas são server-side (`auth.api.*`): o contexto better-auth não
 * recebe um `request`, portanto os hooks de CSRF/origin do próprio better-auth
 * não se aplicam — a validação de URLs de retorno é feita na camada HTTP.
 */
export class BetterAuthGateway implements AuthGateway {
  async signUp(
    input: SignUpAuthInput,
  ): Promise<{ userId: string } & AuthRelay> {
    try {
      const result = await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          cpf: input.cpf,
          phoneNumber: input.phoneNumber,
          callbackURL: input.callbackURL,
        },
        returnHeaders: true,
      });

      const userId = result.response?.user?.id;

      if (!userId) {
        throw new AuthGatewayError("UNKNOWN", "Falha ao criar a conta.");
      }

      return { userId, ...collectRelay(result.headers) };
    } catch (error) {
      if (codeOf(error) === "EMAIL_ALREADY_EXISTS") {
        throw new AuthGatewayError("EMAIL_ALREADY_IN_USE", messageOf(error), {
          cause: error,
        });
      }
      throw toGatewayError(error, "general");
    }
  }

  async signIn(input: SignInAuthInput): Promise<AuthenticatedAuthSession> {
    try {
      const result = await auth.api.signInEmail({
        body: {
          email: input.email,
          password: input.password,
          callbackURL: input.callbackURL,
        },
        returnHeaders: true,
      });

      const token = result.response?.token;
      const user = result.response?.user;

      if (!token || !user) {
        throw new AuthGatewayError(
          "INVALID_CREDENTIALS",
          "E-mail ou senha incorretos.",
        );
      }

      return {
        ...(await this.loadSession(token, user)),
        ...collectRelay(result.headers),
      };
    } catch (error) {
      throw toGatewayError(error, "signIn");
    }
  }

  async getSession(
    headers: RequestHeaders,
  ): Promise<AuthenticatedAuthSession | null> {
    try {
      const result = await auth.api.getSession({
        headers: toWebHeaders(headers),
        query: { disableCookieCache: true },
        returnHeaders: true,
      });

      if (!result.response) return null;

      const { session, user } = result.response;

      return {
        token: session.token,
        user: mapUser(user as BetterAuthUser),
        expiresAt: new Date(session.expiresAt),
        ...collectRelay(result.headers),
      };
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async refreshSession(input: {
    headers?: RequestHeaders;
    token?: string;
  }): Promise<AuthenticatedAuthSession | null> {
    const headers = input.token
      ? { authorization: `Bearer ${input.token}` }
      : (input.headers ?? {});

    const current = await this.getSession(headers);

    if (!current) return null;

    // Estende a sessão respeitando a política por papel (8h gestor / 30d).
    const expiresAt = sessionExpiresAtForRole(current.user.role);

    const context = await auth.$context;
    const updated = await context.internalAdapter.updateSession(current.token, {
      expiresAt,
      updatedAt: new Date(),
    });

    return {
      ...current,
      expiresAt: updated ? new Date(updated.expiresAt) : expiresAt,
    };
  }

  async signOut(headers: RequestHeaders): Promise<AuthRelay> {
    try {
      const result = await auth.api.signOut({
        headers: toWebHeaders(headers),
        returnHeaders: true,
      });

      return collectRelay(result.headers);
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async revokeAllSessions(headers: RequestHeaders): Promise<void> {
    try {
      await auth.api.revokeSessions({
        headers: toWebHeaders(headers),
      });
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async requestEmailVerification(input: {
    email: string;
    callbackURL?: string;
  }): Promise<void> {
    try {
      // Higieniza marcadores de uso único já expirados.
      await db
        .delete(verification)
        .where(
          and(
            like(verification.identifier, "verify-email:%"),
            lt(verification.expiresAt, new Date()),
          ),
        );

      await auth.api.sendVerificationEmail({
        body: {
          email: input.email,
          callbackURL: input.callbackURL,
        },
      });
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async confirmEmailVerification(input: {
    token: string;
    callbackURL?: string;
  }): Promise<{ status: true }> {
    // O token de verificação é um JWT (não fica no banco): registramos o
    // consumo aqui para garantir uso único dentro da validade de 1 hora.
    const digest = createHash("sha256").update(input.token).digest("hex");
    const identifier = `verify-email:${digest}`;

    try {
      const [consumed] = await db
        .select({ id: verification.id })
        .from(verification)
        .where(eq(verification.identifier, identifier));

      if (consumed) {
        throw new AuthGatewayError(
          "INVALID_TOKEN",
          "Token inválido ou já utilizado.",
        );
      }

      await auth.api.verifyEmail({
        query: {
          token: input.token,
          callbackURL: input.callbackURL,
        },
      });

      await db.insert(verification).values({
        identifier,
        value: digest,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      return { status: true };
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async requestPasswordReset(input: {
    email: string;
    redirectTo?: string;
  }): Promise<void> {
    try {
      // Apenas o link mais recente permanece válido.
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email));

      if (user) {
        await deletePendingPasswordResets(user.id);
      }

      await auth.api.requestPasswordReset({
        body: {
          email: input.email,
          redirectTo: input.redirectTo,
        },
      });
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async confirmPasswordReset(input: {
    token: string;
    newPassword: string;
  }): Promise<void> {
    try {
      await auth.api.resetPassword({
        body: {
          token: input.token,
          newPassword: input.newPassword,
        },
      });
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  async changePassword(input: {
    headers: RequestHeaders;
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthRelay> {
    try {
      const current = await this.getSession(input.headers);

      if (!current) {
        throw new AuthGatewayError("UNAUTHORIZED", "Sessão inválida.");
      }

      const result = await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        headers: toWebHeaders(input.headers),
        returnHeaders: true,
      });

      // Links de recuperação antigos deixam de funcionar.
      await deletePendingPasswordResets(current.user.id);

      return collectRelay(result.headers);
    } catch (error) {
      throw toGatewayError(error, "general");
    }
  }

  private async loadSession(
    token: string,
    user: BetterAuthUser,
  ): Promise<AuthSession> {
    const [row] = await db
      .select({ expiresAt: sessionTable.expiresAt })
      .from(sessionTable)
      .where(eq(sessionTable.token, token));

    return {
      token,
      user: mapUser(user),
      expiresAt:
        row?.expiresAt ??
        sessionExpiresAtForRole((user.role ?? "CLIENT") as UserRole),
    };
  }
}

export const authGateway = new BetterAuthGateway();
