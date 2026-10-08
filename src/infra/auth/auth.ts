import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { UserRole } from "../../domain/application/gateways/auth-gateway";
import { Cpf } from "../../domain/enterprise/entities/value-objects/cpf";
import { db } from "../drizzle";
import * as schema from "../drizzle/schema";
import { env } from "../env";
import { sendEmail } from "./email";
import { sessionExpiresAtForRole } from "./session-expiry";

const secret = env.BETTER_AUTH_SECRET ?? env.JWT_SECRET;

if (!secret) {
  throw new Error(
    "Defina BETTER_AUTH_SECRET (ou JWT_SECRET) no ambiente para usar o better-auth.",
  );
}

const trustedOrigins = [
  env.APP_URL,
  `${env.APP_SCHEME}://*`,
  ...(env.TRUSTED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

export const auth = betterAuth({
  secret,
  baseURL: env.APP_URL,
  basePath: "/api/auth",
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    // O modelo `user` aponta para a tabela `users` já existente (user.modelName);
    // session/account/verification usam os exports homônimos do schema.
    schema: { ...schema },
  }),
  advanced: {
    database: {
      // IDs compatíveis com as colunas uuid já existentes.
      generateId: "uuid",
    },
  },
  user: {
    modelName: "users",
    fields: {
      image: "avatarUrl",
    },
    additionalFields: {
      cpf: {
        type: "string",
        required: true,
        input: true,
        // Canônico: 11 dígitos, sem máscara, com dígitos verificadores.
        validator: {
          input: z.string().refine((value) => Cpf.isValid(value), {
            message: "CPF inválido",
          }),
        },
      },
      phoneNumber: {
        type: "string",
        required: false,
        input: true,
      },
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "CLIENT",
      },
    },
  },
  session: {
    // 30 dias por padrão; a política por papel é aplicada no hook abaixo.
    expiresIn: 30 * 24 * 60 * 60,
    // Só o endpoint /api/users/sessions/refresh estende a sessão — assim a
    // janela de 8h do gestor nunca é renovada silenciosamente para 30 dias.
    disableSessionRefresh: true,
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const [row] = await db
            .select({ role: schema.users.role })
            .from(schema.users)
            .where(eq(schema.users.id, session.userId));

          const role = (row?.role ?? "CLIENT") as UserRole;

          return {
            data: {
              ...session,
              expiresAt: sessionExpiresAtForRole(role),
            },
          };
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Redefinição de senha revoga todas as sessões ativas.
    revokeSessionsOnPasswordReset: true,
    // Link de recuperação expira em 1h e é de uso único.
    resetPasswordTokenExpiresIn: 60 * 60,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, token }) => {
      const webUrl = `${env.APP_URL}/reset-password/${token}`;
      const appUrl = `${env.APP_SCHEME}://auth/reset-password?token=${token}`;

      void sendEmail({
        to: user.email,
        subject: "Recupere seu acesso — SmartBarber",
        text: [
          `Olá ${user.name},`,
          "",
          "Recebemos uma solicitação para redefinir sua senha.",
          `Link (válido por 1 hora, uso único): ${webUrl}`,
          `Ou abra o app: ${appUrl}`,
          "",
          "Se não foi você, ignore este e-mail — nenhuma alteração será feita.",
        ].join("\n"),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      const webUrl = `${env.APP_URL}/verify-email?token=${token}`;
      const appUrl = `${env.APP_SCHEME}://auth/verify-email?token=${token}`;

      void sendEmail({
        to: user.email,
        subject: "Confirme seu e-mail — SmartBarber",
        text: [
          `Olá ${user.name},`,
          "",
          "Confirme seu e-mail para ativar a conta.",
          `Link (válido por 1 hora): ${webUrl}`,
          `Ou abra o app: ${appUrl}`,
        ].join("\n"),
      });
    },
  },
  plugins: [bearer()],
});
