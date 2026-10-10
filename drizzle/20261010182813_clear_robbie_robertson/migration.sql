ALTER TABLE "notifications" DROP CONSTRAINT "notifications_booking_id_bookings_id_fkey";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "reference_type" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "reference_id" uuid;--> statement-breakpoint
UPDATE "notifications" AS n
SET
  "user_id" = COALESCE(sc."user_id", b."barberman_id"),
  "reference_type" = 'BOOKING',
  "reference_id" = n."booking_id"
FROM "bookings" AS b
LEFT JOIN "shopping_carts" AS sc ON sc."id" = b."shopping_cart_id"
WHERE n."booking_id" IS NOT NULL AND b."id" = n."booking_id";--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" DROP COLUMN "booking_id";--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");