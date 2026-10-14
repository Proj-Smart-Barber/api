import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../../src/infra/drizzle/schema";

export function validateDiscoveryTestUrl(value: string): URL {
  const target = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^\/sb_discovery_test_[a-z0-9_]+$/.test(target.pathname) ||
    target.search ||
    target.hash
  ) {
    throw new Error(
      "Discovery tests require a dedicated local sb_discovery_test_* database.",
    );
  }
  return target;
}

export interface IsolatedDiscoveryDatabase {
  pool: Pool;
  db: ReturnType<typeof drizzle>;
  schema: string;
  close: () => Promise<void>;
}

export async function createDiscoveryTestDatabase(
  value: string,
): Promise<IsolatedDiscoveryDatabase> {
  const target = validateDiscoveryTestUrl(value);
  const admin = new Pool({ connectionString: value });
  const schemaName = `discovery_${randomUUID().replaceAll("-", "")}`;
  let pool: Pool | undefined;
  let created = false;
  let closed = false;

  async function close() {
    if (closed) return;
    closed = true;
    try {
      if (pool) {
        await pool.end();
      }
    } catch {
      // Ignore pool close error during cleanup
    }
    try {
      if (created) {
        await admin.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      }
    } finally {
      await admin.end();
    }
  }

  try {
    const identity = await admin.query<{ database: string }>(
      "SELECT current_database() AS database",
    );
    if (identity.rows[0]?.database !== target.pathname.slice(1)) {
      throw new Error("Unexpected test database identity.");
    }

    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    created = true;

    pool = new Pool({
      connectionString: value,
      options: `-c search_path=${schemaName},public`,
    });

    // Base tables needed by foreign keys (users, barbershops, membership)
    await pool.query(`
      CREATE TYPE account_type AS ENUM ('CLIENT','BARBER','OWNER','PLATFORM_ADMIN');
      CREATE TYPE role AS ENUM ('OWNER', 'BARBERMAN');
      CREATE TYPE barbershop_status AS ENUM ('ACTIVE', 'INACTIVE');
      CREATE TYPE membership_state AS ENUM ('ACTIVE', 'INACTIVE');

      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        avatar_url text,
        email text NOT NULL UNIQUE,
        password text NOT NULL,
        cpf text NOT NULL UNIQUE,
        phone_number text,
        email_verified_at timestamp,
        account_type account_type NOT NULL DEFAULT 'CLIENT',
        credential_version integer NOT NULL DEFAULT 1,
        onboarding_intent text,
        created_at timestamp DEFAULT now()
      );

      CREATE TABLE barbershops (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        avatar_url text,
        owner_id uuid NOT NULL REFERENCES users(id),
        slug text NOT NULL UNIQUE,
        cnpj text NOT NULL UNIQUE,
        location text NOT NULL,
        timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
        status barbershop_status NOT NULL DEFAULT 'ACTIVE',
        created_at timestamp DEFAULT now()
      );

      CREATE TABLE membership (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        role role NOT NULL DEFAULT 'BARBERMAN',
        barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        state membership_state NOT NULL DEFAULT 'ACTIVE',
        version integer NOT NULL DEFAULT 1,
        ended_at timestamptz,
        created_at timestamp DEFAULT now(),
        UNIQUE(barbershop_id, user_id)
      );

      CREATE TABLE services (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        barbershop_id uuid REFERENCES barbershops(id) ON DELETE CASCADE,
        title text NOT NULL,
        description text,
        price_in_cents integer NOT NULL,
        duration_in_minutes integer NOT NULL DEFAULT 30,
        is_active boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      );

      CREATE TABLE service_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id uuid REFERENCES services(id),
        title_snapshot text,
        price_in_cents_snapshot integer,
        duration_in_minutes_snapshot integer,
        created_at timestamp DEFAULT now()
      );

      CREATE TABLE shopping_carts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        service_item_id uuid REFERENCES service_items(id),
        total_price_in_cents integer,
        created_at timestamp DEFAULT now()
      );

      CREATE TABLE bookings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        barbershop_id uuid NOT NULL REFERENCES barbershops(id) ON DELETE CASCADE,
        barberman_id uuid REFERENCES users(id),
        customer_id uuid REFERENCES users(id),
        shopping_cart_id uuid REFERENCES shopping_carts(id),
        date text,
        start_time text,
        end_time text,
        status text DEFAULT 'CONFIRMED',
        created_at timestamp DEFAULT now()
      );

      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title text NOT NULL,
        content text NOT NULL,
        read boolean NOT NULL DEFAULT false,
        created_at timestamp DEFAULT now()
      );
    `);

    // biome-ignore lint/suspicious/noExplicitAny: DrizzlePgConfig in drizzle-orm/node-postgres v1.0.0-rc.4 omits schema in its single-object driver signature
    const dbInstance = drizzle({ client: pool, schema } as any);
    return {
      pool,
      db: dbInstance,
      schema: schemaName,
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
