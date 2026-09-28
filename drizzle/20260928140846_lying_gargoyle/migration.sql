ALTER TABLE "service_items" ADD COLUMN IF NOT EXISTS "title_snapshot" text;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN IF NOT EXISTS "price_in_cents_snapshot" integer;--> statement-breakpoint
ALTER TABLE "service_items" ADD COLUMN IF NOT EXISTS "duration_in_minutes_snapshot" integer;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "barbershop_id" uuid;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();--> statement-breakpoint
UPDATE "service_items"
SET
  "title_snapshot" = "services"."title",
  "price_in_cents_snapshot" = "services"."price_in_cents",
  "duration_in_minutes_snapshot" = "services"."duration_in_minutes"
FROM "services"
WHERE "service_items"."service_id" = "services"."id"
  AND "service_items"."title_snapshot" IS NULL;--> statement-breakpoint
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
  AND s.barbershop_id IS NULL;--> statement-breakpoint
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
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "services_barbershop_active_title_id_idx" ON "services" ("barbershop_id","is_active","title","id");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM services WHERE barbershop_id IS NULL) THEN
    ALTER TABLE "services" ALTER COLUMN "barbershop_id" SET NOT NULL;
  END IF;
END $$;