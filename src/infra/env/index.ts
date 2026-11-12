import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string(),
  EMAIL_VERIFICATION_CODE_SECRET: z.string().min(32).optional(),
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
  EMAIL_VERIFICATION_URL: z
    .union([z.url(), z.literal("")])
    .optional()
    .transform((value) => (value ? value : undefined)),
  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string().min(1),
  VERIFICATION_TOKEN_EXPIRES_IN: z.string().default("1d"),
  PASSWORD_RECOVERY_TOKEN_EXPIRES_IN: z.string().default("1h"),
  INVITATION_EXPIRES_IN: z.string().default("7d"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_STAGING_BUCKET: z.string().optional(),
  STORAGE_PUBLIC_BUCKET: z.string().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_PUBLIC_URL: z.string().optional(),
  STORAGE_REGION: z.string().optional().default("auto"),
  MEDIA_VIDEO_ENABLED: z.enum(["true", "false"]).optional().default("false"),
  R2_GLOBAL_BUDGET_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  R2_SHOP_BUDGET_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .optional(),
  CRON_SECRET: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(50).optional(),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(60000)
    .default(5000),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(300000)
    .default(30000),
  DB_STATEMENT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(500)
    .max(120000)
    .default(15000),
  DB_LOCK_TIMEOUT_MS: z.coerce.number().int().min(200).max(60000).default(5000),
  DB_IDLE_IN_TX_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .max(120000)
    .default(10000),
  AUTO_RUN_MIGRATIONS: z.enum(["true", "false"]).optional(),
  ENABLE_PUBLIC_HTTP_CACHE: z.enum(["true", "false"]).optional(),
  ENABLE_REQUEST_METRICS: z.enum(["true", "false"]).optional(),
  FF_SQL_BOOKING_BATCH_HYDRATION: z.enum(["true", "false"]).default("true"),
});

export const env = envSchema.parse(process.env);
