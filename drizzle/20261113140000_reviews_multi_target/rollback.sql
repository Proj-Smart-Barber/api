-- Rollback for multi-target reviews & platform feedback migration
-- Preserves existing main rows in "reviews" and restores barbershop aggregate counts from published reviews.

DROP INDEX IF EXISTS "platform_feedbacks_customer_idx";
DROP TABLE IF EXISTS "platform_feedbacks";

DROP INDEX IF EXISTS "review_items_booking_service_item_idx";
DROP INDEX IF EXISTS "review_items_target_lookup_idx";
DROP INDEX IF EXISTS "review_items_review_target_id_uidx";
DROP INDEX IF EXISTS "review_items_review_target_key_uidx";
DROP TABLE IF EXISTS "review_items";

DROP INDEX IF EXISTS "reviews_barbershop_status_created_idx";

ALTER TABLE "services" DROP COLUMN IF EXISTS "review_count";
ALTER TABLE "services" DROP COLUMN IF EXISTS "rating";

UPDATE "barbershops" b
SET
  "rating" = COALESCE(agg."avg_rating", 0)::numeric(3, 2),
  "review_count" = COALESCE(agg."review_count", 0)
FROM (
  SELECT
    b2."id" AS barbershop_id,
    ROUND(AVG(r."rating")::numeric, 2) AS avg_rating,
    COUNT(r."id")::int AS review_count
  FROM "barbershops" b2
  LEFT JOIN "reviews" r
    ON r."barbershop_id" = b2."id" AND r."status" = 'PUBLISHED'
  GROUP BY b2."id"
) agg
WHERE b."id" = agg."barbershop_id";
