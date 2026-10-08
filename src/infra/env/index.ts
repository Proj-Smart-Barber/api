import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  /** Legado: usado como fallback do segredo do better-auth. */
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRES_IN: z.string().optional(),
  /** Segredo do better-auth (sessões, cookies assinados, tokens de e-mail). */
  BETTER_AUTH_SECRET: z.string().optional(),
  PORT: z.coerce.number().optional().default(3333),
  NODE_ENV: z.string(),
  APP_URL: z.url(),
  /** Deep link scheme do app mobile (ex.: smartbarber://auth/...). */
  APP_SCHEME: z.string().optional().default("smartbarber"),
  /** Origens extras aceitas pelo better-auth, separadas por vírgula. */
  TRUSTED_ORIGINS: z.string().optional(),
  /** Resend (confirmação de e-mail e recuperação de senha). */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
