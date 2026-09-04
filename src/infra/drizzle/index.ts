import "dotenv/config";

import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { env } from "../env";

const nodeEnv = env.NODE_ENV;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

export const db =
  nodeEnv === "production"
    ? drizzleNeon({
        client: pool,
      })
    : drizzlePg(env.DATABASE_URL);
