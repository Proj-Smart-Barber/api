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

    // 9. Verificação de e-mail e recuperação de senha
    await db.execute(sql`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "email_verifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "token_hash" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "email_verifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "email_verifications_user_id_idx" ON "email_verifications" ("user_id");
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "password_recovery_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" uuid NOT NULL,
        "token_hash" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "used_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "password_recovery_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "password_recovery_tokens_user_id_idx" ON "password_recovery_tokens" ("user_id");
    `);

    // 10. Atualização de esquema de notificações
    await db.execute(sql`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
          ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" uuid;
          ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "reference_type" text;
          ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "reference_id" uuid;

          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'booking_id') THEN
            UPDATE "notifications" AS n
            SET
              "user_id" = COALESCE(sc."user_id", b."barberman_id"),
              "reference_type" = 'BOOKING',
              "reference_id" = n."booking_id"
            FROM "bookings" AS b
            LEFT JOIN "shopping_carts" AS sc ON sc."id" = b."shopping_cart_id"
            WHERE n."booking_id" IS NOT NULL AND b."id" = n."booking_id" AND n."user_id" IS NULL;

            ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_booking_id_bookings_id_fkey";
            ALTER TABLE "notifications" ALTER COLUMN "booking_id" DROP NOT NULL;
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_users_id_fkey') THEN
            ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
          END IF;
        END IF;
      END $$;
    `);

    // 11. Novas colunas de bookings (reserva múltipla e status)
    await db.execute(sql`
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "client_request_id" text;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "status" text;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "payment_status" text;
    `);

    // 12. Extensões de usuário e registro de barbeiros
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
          CREATE TYPE "account_type" AS ENUM ('CLIENT', 'BARBER', 'OWNER', 'PLATFORM_ADMIN');
        END IF;
      END $$;

      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "account_type" "account_type" DEFAULT 'CLIENT' NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "credential_version" integer DEFAULT 1 NOT NULL;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_intent" text;

      CREATE TABLE IF NOT EXISTS "barber_registrations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "barbershop_id" uuid NOT NULL,
        "invitation_id" uuid NOT NULL,
        "name" text NOT NULL,
        "cpf" text NOT NULL,
        "email" text NOT NULL,
        "token_hash" text NOT NULL UNIQUE,
        "status" "invitation_status" DEFAULT 'PENDING' NOT NULL,
        "expires_at" timestamp NOT NULL,
        "responded_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "barber_registrations_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE,
        CONSTRAINT "barber_registrations_invitation_id_invitations_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE
      );
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
