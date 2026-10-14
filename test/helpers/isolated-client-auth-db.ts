import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

export function validateClientAuthTestUrl(value: string): URL {
  const target = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/sb_client_auth_test_[a-z0-9_]+$/.test(target.pathname) ||
    target.search ||
    target.hash
  )
    throw new Error(
      "Client auth tests require a dedicated local sb_client_auth_test_* database.",
    );
  return target;
}

export async function createClientAuthTestDatabase(value: string) {
  const target = validateClientAuthTestUrl(value);
  const admin = new Pool({ connectionString: value });
  const schema = `client_auth_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool | undefined;
  let created = false;
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
  try {
    const identity = await admin.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    if (identity.rows[0]?.database !== target.pathname.slice(1))
      throw new Error("Unexpected test database identity.");
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    pool = new Pool({
      connectionString: value,
      options: `-c search_path=${schema}`,
    });
    await pool.query(`
      CREATE TYPE account_type AS ENUM ('CLIENT','BARBER','OWNER','PLATFORM_ADMIN');
      CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
        avatar_url text, email text NOT NULL UNIQUE, password text NOT NULL, cpf text NOT NULL UNIQUE,
        phone_number text, email_verified_at timestamp, account_type account_type NOT NULL DEFAULT 'CLIENT',
        credential_version integer NOT NULL DEFAULT 1, onboarding_intent text, created_at timestamp DEFAULT now());
      CREATE TABLE email_verifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL UNIQUE,
        expires_at timestamp NOT NULL, used_at timestamp, created_at timestamp DEFAULT now());
      CREATE TABLE refresh_tokens (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id), token_hash text NOT NULL UNIQUE, family_id uuid NOT NULL,
        expires_at timestamp NOT NULL, revoked_at timestamp, replaced_by_token_id uuid, created_at timestamp DEFAULT now());
      CREATE TABLE barbershops (id uuid PRIMARY KEY, name text NOT NULL, avatar_url text,
        owner_id uuid NOT NULL REFERENCES users(id), slug text NOT NULL UNIQUE, cnpj text NOT NULL UNIQUE,
        location text NOT NULL, timezone text NOT NULL, status text NOT NULL, created_at timestamp DEFAULT now());
      CREATE TABLE membership (id uuid PRIMARY KEY, role text NOT NULL,
        barbershop_id uuid NOT NULL REFERENCES barbershops(id), user_id uuid NOT NULL REFERENCES users(id),
        state text NOT NULL DEFAULT 'ACTIVE', version integer NOT NULL DEFAULT 1, ended_at timestamptz,
        created_at timestamp DEFAULT now(), UNIQUE(barbershop_id,user_id));
      CREATE TABLE customer_lookup_rate_limits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key text NOT NULL UNIQUE, count integer NOT NULL DEFAULT 1, reset_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now());
    `);
    return { pool, db: drizzle({ client: pool }), schema, close };
  } catch (error) {
    await close();
    throw error;
  }
}
