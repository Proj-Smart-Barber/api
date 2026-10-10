import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
  JWT_EXPIRES_IN: z.string().optional(),
  PORT: z.coerce.number().optional().default(3333),
  NODE_ENV: z.string(),
  APP_URL: z.url(),
  FRONTEND_URL: z
    .union([z.url(), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().min(1),
  VERIFICATION_TOKEN_EXPIRES_IN: z.string().default("1d"),
  PASSWORD_RECOVERY_TOKEN_EXPIRES_IN: z.string().default("1h"),
  INVITATION_EXPIRES_IN: z.string().default("7d"),
});

export const env = envSchema.parse(process.env);
