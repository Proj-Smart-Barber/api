import { sql } from "drizzle-orm";
import { db } from "./index";

let hasMigrated = false;

export async function runSchemaMigrations() {
  if (hasMigrated) {
    return {
      success: true,
      message: "Migration already completed in this process.",
    };
  }

  console.log("[Migration] Running idempotent schema migrations...");

  try {
    // 1. service_items snapshots
    await db.execute(sql`
      ALTER TABLE "service_items" ADD COLUMN IF NOT EXISTS "title_snapshot" text;
      ALTER TABLE "service_items" ADD COLUMN IF NOT EXISTS "price_in_cents_snapshot" integer;
      ALTER TABLE "service_items" ADD COLUMN IF NOT EXISTS "duration_in_minutes_snapshot" integer;
    `);

    // 2. services new columns
    await db.execute(sql`
      ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "barbershop_id" uuid;
      ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;
      ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
    `);

    // 3. Backfill snapshots from current service state if missing
    await db.execute(sql`
      UPDATE "service_items"
      SET
        "title_snapshot" = "services"."title",
        "price_in_cents_snapshot" = "services"."price_in_cents",
        "duration_in_minutes_snapshot" = "services"."duration_in_minutes"
      FROM "services"
      WHERE "service_items"."service_id" = "services"."id"
        AND "service_items"."title_snapshot" IS NULL;
    `);

    // 4. Backfill services barbershop_id if orphan
    await db.execute(sql`
      WITH distinct_pairs AS (
        SELECT DISTINCT
          si.service_id,
          b.barbershop_id
        FROM service_items si
        JOIN shopping_carts sc ON sc.service_item_id = si.id
        JOIN bookings b ON b.shopping_cart_id = sc.id
        WHERE b.barbershop_id IS NOT NULL
      ),
      single_shop_services AS (
        SELECT
          service_id,
          (array_agg(barbershop_id))[1] as barbershop_id
        FROM distinct_pairs
        GROUP BY service_id
        HAVING COUNT(*) = 1
      )
      UPDATE services s
      SET barbershop_id = sss.barbershop_id
      FROM single_shop_services sss
      WHERE s.id = sss.service_id
        AND s.barbershop_id IS NULL;
    `);

    // 5. Constraints and check validations
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'services_barbershop_id_barbershops_id_fkey'
        ) THEN
          ALTER TABLE "services" ADD CONSTRAINT "services_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'services_price_positive_check'
        ) THEN
          ALTER TABLE "services" ADD CONSTRAINT "services_price_positive_check" CHECK ("price_in_cents" > 0);
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'services_duration_positive_check'
        ) THEN
          ALTER TABLE "services" ADD CONSTRAINT "services_duration_positive_check" CHECK ("duration_in_minutes" > 0);
        END IF;
      END $$;
    `);

    // 6. Indices
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "services_barbershop_active_title_id_idx" ON "services" ("barbershop_id","is_active","title","id");
    `);

    // 7. Unificação de staffs e customers para users
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staffs') THEN
          ALTER TABLE "staffs" RENAME TO "users";
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
          ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
          INSERT INTO "users" ("id", "name", "avatar_url", "email", "password", "cpf", "phone_number", "created_at")
          SELECT "id", "name", "avatar_url", "email", "password", "cpf", "phone_number", "created_at"
          FROM "customers"
          ON CONFLICT ("id") DO NOTHING;
          DROP TABLE "customers" CASCADE;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'membership' AND column_name = 'staff_id') THEN
          ALTER TABLE "membership" RENAME COLUMN "staff_id" TO "user_id";
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shopping_carts' AND column_name = 'customer_id') THEN
          ALTER TABLE "shopping_carts" RENAME COLUMN "customer_id" TO "user_id";
        END IF;
      END $$;
    `);

    // 8. Better Auth: tipo de conta, novas colunas de usuários, tabelas de
    //    sessão/credencial/token e backfills (papel por vínculo + CPF canônico)
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE "user_role" AS ENUM ('CLIENT', 'BARBER', 'OWNER', 'PLATFORM_ADMIN');
        END IF;

        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "user_role" NOT NULL DEFAULT 'CLIENT';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" boolean NOT NULL DEFAULT false;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp NOT NULL DEFAULT now();
        -- Credenciais agora vivem em account.password (better-auth)
        ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;
      END $$;
    `);

    // 8.1 Papel autoritativo a partir do vínculo existente (nunca inferido no cliente)
    await db.execute(sql`
      UPDATE "users" u
      SET "role" = CASE
        WHEN EXISTS (
          SELECT 1 FROM "membership" m
          WHERE m."user_id" = u."id" AND m."role" = 'OWNER'
        ) THEN 'OWNER'::"user_role"
        WHEN EXISTS (
          SELECT 1 FROM "membership" m
          WHERE m."user_id" = u."id" AND m."role" = 'BARBERMAN'
        ) THEN 'BARBER'::"user_role"
        ELSE u."role"
      END
      WHERE u."role" = 'CLIENT';
    `);

    // 8.2 CPF canônico (somente dígitos), sem quebrar unicidade
    await db.execute(sql`
      UPDATE "users" u
      SET "cpf" = regexp_replace(u."cpf", '\D', '', 'g')
      WHERE u."cpf" ~ '\D'
        AND NOT EXISTS (
          SELECT 1 FROM "users" u2
          WHERE u2."cpf" = regexp_replace(u."cpf", '\D', '', 'g')
            AND u2."id" <> u."id"
        );
    `);

    // 8.3 Tabelas better-auth (session/account/verification)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "account_id" text NOT NULL,
        "provider_id" text NOT NULL,
        "user_id" uuid NOT NULL,
        "access_token" text,
        "refresh_token" text,
        "id_token" text,
        "access_token_expires_at" timestamp,
        "refresh_token_expires_at" timestamp,
        "scope" text,
        "password" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "session" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "expires_at" timestamp NOT NULL,
        "token" text NOT NULL UNIQUE,
        "ip_address" text,
        "user_agent" text,
        "user_id" uuid NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "verification" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "identifier" text NOT NULL,
        "value" text NOT NULL,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");
      CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");
      CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'account_user_id_users_id_fkey'
        ) THEN
          ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'session_user_id_users_id_fkey'
        ) THEN
          ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    hasMigrated = true;
    console.log("[Migration] Schema migrations completed successfully.");
    return {
      success: true,
      message: "Schema migrations executed successfully.",
    };
  } catch (error) {
    console.error("[Migration] Schema migration failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
