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

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "token_hash" text NOT NULL,
        "family_id" uuid NOT NULL,
        "expires_at" timestamp NOT NULL,
        "revoked_at" timestamp,
        "replaced_by_token_id" uuid,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE ("token_hash"),
        CONSTRAINT "refresh_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");
      CREATE INDEX IF NOT EXISTS "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");
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

    // 8. Convites de barbeiros
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status') THEN
          CREATE TYPE "invitation_status" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "invitations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barbershop_id" uuid NOT NULL,
        "email" text NOT NULL,
        "role" "role" DEFAULT 'BARBERMAN' NOT NULL,
        "token_hash" text NOT NULL,
        "status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
        "expires_at" timestamp NOT NULL,
        "invited_by_id" uuid NOT NULL,
        "responded_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "invitations_token_hash_unique" UNIQUE ("token_hash"),
        CONSTRAINT "invitations_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE,
        CONSTRAINT "invitations_invited_by_id_users_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id")
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "invitations_barbershop_email_idx" ON "invitations" ("barbershop_id","email");
      CREATE INDEX IF NOT EXISTS "invitations_status_idx" ON "invitations" ("status");
    `);

    // 9. B1 — Booking items, snapshots, history and backwards-compatible columns
    await db.execute(sql`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_id" uuid;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "total_price_in_cents" integer;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "total_duration_in_minutes" integer;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();
      ALTER TABLE "bookings" ALTER COLUMN "shopping_cart_id" DROP NOT NULL;
    `);

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_customer_id_users_id_fkey'
        ) THEN
          ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id");
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'bookings_created_by_user_id_users_id_fkey'
        ) THEN
          ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_user_id_users_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id");
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "bookings_barbershop_starts_at_id_idx" ON "bookings" ("barbershop_id", "starts_at", "id");
      CREATE INDEX IF NOT EXISTS "bookings_barberman_starts_ends_idx" ON "bookings" ("barberman_id", "starts_at", "ends_at");
      CREATE INDEX IF NOT EXISTS "bookings_customer_id_idx" ON "bookings" ("customer_id");
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "booking_service_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "booking_id" uuid NOT NULL,
        "service_id" uuid,
        "title" text NOT NULL,
        "price_in_cents" integer,
        "duration_in_minutes" integer,
        "legacy_aggregate" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "booking_service_items_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "booking_service_items_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "booking_service_items_booking_id_idx" ON "booking_service_items" ("booking_id");
      CREATE INDEX IF NOT EXISTS "booking_service_items_service_id_idx" ON "booking_service_items" ("service_id");
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "booking_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "booking_id" uuid NOT NULL,
        "actor_id" uuid,
        "event_type" text NOT NULL,
        "previous_version" integer,
        "new_version" integer NOT NULL,
        "previous_status" text,
        "new_status" text,
        "reason" text,
        "metadata" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "booking_events_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE,
        CONSTRAINT "booking_events_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id")
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "booking_events_booking_id_created_at_idx" ON "booking_events" ("booking_id", "created_at");
    `);

    await db.execute(sql`
      UPDATE "bookings" AS b
      SET
        "customer_id" = sc."user_id",
        "created_by_user_id" = COALESCE(b."created_by_user_id", sc."user_id"),
        "total_price_in_cents" = COALESCE(b."total_price_in_cents", sc."total_price_in_cents"),
        "total_duration_in_minutes" = COALESCE(b."total_duration_in_minutes", si."duration_in_minutes_snapshot")
      FROM "shopping_carts" AS sc
      LEFT JOIN "service_items" AS si ON si."id" = sc."service_item_id"
      WHERE b."shopping_cart_id" = sc."id"
        AND b."customer_id" IS NULL;
    `);

    await db.execute(sql`
      UPDATE "bookings" AS b
      SET
        "starts_at" = (b."date"::date + b."start_time"::time) AT TIME ZONE COALESCE(bs."timezone", 'America/Sao_Paulo'),
        "ends_at" = (b."date"::date + b."end_time"::time) AT TIME ZONE COALESCE(bs."timezone", 'America/Sao_Paulo')
      FROM "barbershops" AS bs
      WHERE b."barbershop_id" = bs."id"
        AND b."starts_at" IS NULL
        AND b."date" IS NOT NULL
        AND b."start_time" IS NOT NULL
        AND b."end_time" IS NOT NULL;
    `);

    await db.execute(sql`
      INSERT INTO "booking_service_items" (
        "id",
        "booking_id",
        "service_id",
        "title",
        "price_in_cents",
        "duration_in_minutes",
        "legacy_aggregate",
        "created_at"
      )
      SELECT
        gen_random_uuid(),
        b."id",
        CASE
          WHEN si."title_snapshot" LIKE '% + %' AND s."title" != si."title_snapshot" THEN NULL
          ELSE si."service_id"
        END,
        COALESCE(si."title_snapshot", s."title", 'Serviço'),
        si."price_in_cents_snapshot",
        si."duration_in_minutes_snapshot",
        CASE
          WHEN si."title_snapshot" LIKE '% + %' THEN true
          ELSE false
        END,
        b."created_at"
      FROM "bookings" AS b
      JOIN "shopping_carts" AS sc ON sc."id" = b."shopping_cart_id"
      JOIN "service_items" AS si ON si."id" = sc."service_item_id"
      LEFT JOIN "services" AS s ON s."id" = si."service_id"
      WHERE NOT EXISTS (
        SELECT 1 FROM "booking_service_items" bsi WHERE bsi."booking_id" = b."id"
      );
    `);

    await db.execute(sql`
      INSERT INTO "booking_events" (
        "id",
        "booking_id",
        "actor_id",
        "event_type",
        "previous_version",
        "new_version",
        "previous_status",
        "new_status",
        "reason",
        "metadata",
        "created_at"
      )
      SELECT
        gen_random_uuid(),
        b."id",
        b."customer_id",
        'CREATED',
        NULL,
        b."version",
        NULL,
        COALESCE(b."status", 'CONFIRMED'),
        'Migração legada de agendamentos',
        '{"legacyShoppingCartId":"' || b."shopping_cart_id" || '"}',
        COALESCE(b."created_at", now())
      FROM "bookings" AS b
      WHERE NOT EXISTS (
        SELECT 1 FROM "booking_events" be WHERE be."booking_id" = b."id"
      );
    `);

    // 10. Grupo 1 — Vínculos ACTIVE/INACTIVE, versionamento e ledger de operações
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_state') THEN
          CREATE TYPE "membership_state" AS ENUM ('ACTIVE', 'INACTIVE');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_attempt_state') THEN
          CREATE TYPE "operation_attempt_state" AS ENUM ('PENDING', 'APPLIED', 'NOT_APPLIED');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_resource_kind') THEN
          CREATE TYPE "operation_resource_kind" AS ENUM ('BOOKING', 'MEMBERSHIP', 'REGISTRATION', 'INVITATION');
        END IF;
      END $$;
    `);

    await db.execute(sql`
      ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "state" "membership_state" DEFAULT 'ACTIVE' NOT NULL;
      ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
      ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "membership_barbershop_state_created_idx"
      ON "membership" ("barbershop_id", "state", "created_at", "id");
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "operation_attempts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "actor_id" uuid NOT NULL,
        "request_id" text NOT NULL,
        "operation" text NOT NULL,
        "payload_hash" text NOT NULL,
        "state" "operation_attempt_state" DEFAULT 'PENDING' NOT NULL,
        "resource_kind" "operation_resource_kind",
        "resource_id" text,
        "resource_version" integer,
        "response_payload" text,
        "terminal_reason" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
        "expires_at" timestamp with time zone NOT NULL,
        CONSTRAINT "operation_attempts_actor_request_unique" UNIQUE ("actor_id", "request_id"),
        CONSTRAINT "operation_attempts_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "operation_attempts_actor_request_idx"
      ON "operation_attempts" ("actor_id", "request_id");
      CREATE INDEX IF NOT EXISTS "operation_attempts_expires_at_idx"
      ON "operation_attempts" ("expires_at");
    `);

    // 11. Grupo 2 — Notificações idempotentes por evento e rate limit de customer lookup
    await db.execute(sql`
      ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "event_id" uuid;
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'notifications_event_user_unique'
        ) THEN
          ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_user_unique" UNIQUE ("event_id", "user_id");
        END IF;
      END $$;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "customer_lookup_rate_limits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" text NOT NULL,
        "count" integer DEFAULT 1 NOT NULL,
        "reset_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now(),
        CONSTRAINT "customer_lookup_rate_limits_key_unique" UNIQUE ("key")
      );
      CREATE INDEX IF NOT EXISTS "customer_lookup_rate_limits_key_idx" ON "customer_lookup_rate_limits" ("key");
      CREATE INDEX IF NOT EXISTS "customer_lookup_rate_limits_reset_at_idx" ON "customer_lookup_rate_limits" ("reset_at");
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
