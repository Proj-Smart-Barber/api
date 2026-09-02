import "dotenv/config";

import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";

const env = process.env.NODE_ENV;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db =
  env === "production"
    ? drizzleNeon({
        client: pool,
      })
    : drizzlePg(process.env.DATABASE_URL!);
