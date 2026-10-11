-- Migration: 20261011180000_booking_items_history
-- Description: Persistência de itens de agendamento individuais, snapshots e histórico com rastreabilidade

-- 1. Colunas e constraints na tabela bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "created_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "total_price_in_cents" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "total_duration_in_minutes" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "shopping_cart_id" DROP NOT NULL;--> statement-breakpoint

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
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "bookings_barbershop_starts_at_id_idx" ON "bookings" ("barbershop_id", "starts_at", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_barberman_starts_ends_idx" ON "bookings" ("barberman_id", "starts_at", "ends_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookings_customer_id_idx" ON "bookings" ("customer_id");--> statement-breakpoint

-- 2. Tabela booking_service_items
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
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "booking_service_items_booking_id_idx" ON "booking_service_items" ("booking_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "booking_service_items_service_id_idx" ON "booking_service_items" ("service_id");--> statement-breakpoint

-- 3. Tabela booking_events (histórico)
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
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "booking_events_booking_id_created_at_idx" ON "booking_events" ("booking_id", "created_at");--> statement-breakpoint

-- 4. Backfill forward conservador e compatível

-- 4.1. Preencher customer_id e created_by_user_id a partir de shopping_carts
UPDATE "bookings" AS b
SET
  "customer_id" = sc."user_id",
  "created_by_user_id" = COALESCE(b."created_by_user_id", sc."user_id"),
  "total_price_in_cents" = COALESCE(b."total_price_in_cents", sc."total_price_in_cents"),
  "total_duration_in_minutes" = COALESCE(b."total_duration_in_minutes", si."duration_in_minutes_snapshot")
FROM "shopping_carts" AS sc
LEFT JOIN "service_items" AS si ON si."id" = sc."service_item_id"
WHERE b."shopping_cart_id" = sc."id"
  AND b."customer_id" IS NULL;--> statement-breakpoint

-- 4.2. Preencher starts_at e ends_at a partir do fuso da barbearia quando presentes
UPDATE "bookings" AS b
SET
  "starts_at" = (b."date"::date + b."start_time"::time) AT TIME ZONE COALESCE(bs."timezone", 'America/Sao_Paulo'),
  "ends_at" = (b."date"::date + b."end_time"::time) AT TIME ZONE COALESCE(bs."timezone", 'America/Sao_Paulo')
FROM "barbershops" AS bs
WHERE b."barbershop_id" = bs."id"
  AND b."starts_at" IS NULL
  AND b."date" IS NOT NULL
  AND b."start_time" IS NOT NULL
  AND b."end_time" IS NOT NULL;--> statement-breakpoint

-- 4.3. Backfill de booking_service_items preservando agregados legados
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
);--> statement-breakpoint

-- 4.4. Evento inicial de histórico para reservas legadas
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
