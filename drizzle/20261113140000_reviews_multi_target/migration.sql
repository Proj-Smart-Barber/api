-- Multi-target reviews & isolated platform feedback migration (idempotent)

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "rating" numeric(3, 2) NOT NULL DEFAULT '0.00';
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "review_count" integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "reviews_barbershop_status_created_idx"
  ON "reviews" ("barbershop_id", "status", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "review_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "review_id" uuid NOT NULL REFERENCES "reviews"("id") ON DELETE CASCADE,
  "booking_id" uuid NOT NULL REFERENCES "bookings"("id") ON DELETE CASCADE,
  "target_type" text NOT NULL,
  "target_key" text NOT NULL,
  "target_id" uuid,
  "booking_service_item_id" uuid REFERENCES "booking_service_items"("id") ON DELETE SET NULL,
  "target_label" text NOT NULL,
  "rating" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "review_items_target_type_check" CHECK ("target_type" IN ('BARBERSHOP', 'BARBER', 'SERVICE')),
  CONSTRAINT "review_items_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "review_items_review_target_key_uidx"
  ON "review_items" ("review_id", "target_key");

CREATE UNIQUE INDEX IF NOT EXISTS "review_items_review_target_id_uidx"
  ON "review_items" ("review_id", "target_type", "target_id")
  WHERE "target_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "review_items_target_lookup_idx"
  ON "review_items" ("target_type", "target_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "review_items_booking_service_item_idx"
  ON "review_items" ("booking_service_item_id")
  WHERE "booking_service_item_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "platform_feedbacks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "booking_id" uuid NOT NULL UNIQUE REFERENCES "bookings"("id") ON DELETE CASCADE,
  "review_id" uuid REFERENCES "reviews"("id") ON DELETE SET NULL,
  "customer_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "rating" integer,
  "comment" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_feedbacks_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE INDEX IF NOT EXISTS "platform_feedbacks_customer_idx"
  ON "platform_feedbacks" ("customer_id", "created_at" DESC);

-- Backfill existing barbershop reviews into review_items idempotently
INSERT INTO "review_items" (
  "review_id",
  "booking_id",
  "target_type",
  "target_key",
  "target_id",
  "booking_service_item_id",
  "target_label",
  "rating",
  "created_at",
  "updated_at"
)
SELECT
  r."id",
  r."booking_id",
  'BARBERSHOP',
  'BARBERSHOP:' || r."barbershop_id"::text,
  r."barbershop_id",
  NULL,
  COALESCE(b."name", 'Barbearia'),
  r."rating",
  r."created_at",
  r."updated_at"
FROM "reviews" r
LEFT JOIN "barbershops" b ON b."id" = r."barbershop_id"
ON CONFLICT ("review_id", "target_key") DO NOTHING;

-- Recalculate barbershop metrics strictly from published BARBERSHOP items
UPDATE "barbershops" b
SET
  "rating" = COALESCE(agg."avg_rating", 0)::numeric(3, 2),
  "review_count" = COALESCE(agg."review_count", 0)
FROM (
  SELECT
    b2."id" AS barbershop_id,
    ROUND(AVG(CASE WHEN r."status" = 'PUBLISHED' THEN ri."rating" END)::numeric, 2) AS avg_rating,
    COUNT(CASE WHEN r."status" = 'PUBLISHED' THEN ri."id" END)::int AS review_count
  FROM "barbershops" b2
  LEFT JOIN "review_items" ri
    ON ri."target_type" = 'BARBERSHOP' AND ri."target_id" = b2."id"
  LEFT JOIN "reviews" r
    ON r."id" = ri."review_id"
  GROUP BY b2."id"
) agg
WHERE b."id" = agg."barbershop_id";

UPDATE "services" s
SET
  "rating" = COALESCE(agg."avg_rating", 0)::numeric(3, 2),
  "review_count" = COALESCE(agg."review_count", 0)
FROM (
  SELECT
    s2."id" AS service_id,
    ROUND(AVG(CASE WHEN r."status" = 'PUBLISHED' THEN ri."rating" END)::numeric, 2) AS avg_rating,
    COUNT(CASE WHEN r."status" = 'PUBLISHED' THEN ri."id" END)::int AS review_count
  FROM "services" s2
  LEFT JOIN "review_items" ri
    ON ri."target_type" = 'SERVICE' AND ri."target_id" = s2."id"
  LEFT JOIN "reviews" r
    ON r."id" = ri."review_id"
  GROUP BY s2."id"
) agg
WHERE s."id" = agg."service_id";
