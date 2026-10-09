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
});

export const env = envSchema.parse(process.env);
