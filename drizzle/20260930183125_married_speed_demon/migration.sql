CREATE TYPE "user_type" AS ENUM('STAFF', 'CUSTOMER');--> statement-breakpoint
ALTER TABLE "staffs" RENAME TO "users";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "user_type" "user_type" NOT NULL;--> statement-breakpoint
UPDATE "users" SET "user_type" = 'STAFF';--> statement-breakpoint
INSERT INTO "users" ("name", "avatar_url", "email", "password", "cpf", "phone_number", "user_type", "created_at") SELECT "name", "avatar_url", "email", "password", "cpf", "phone_number", 'CUSTOMER'::"user_type", "created_at" FROM "customers";--> statement-breakpoint
DROP TABLE "customers";--> statement-breakpoint
ALTER TABLE "membership" RENAME COLUMN "staff_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "shopping_carts" RENAME COLUMN "customer_id" TO "user_id";--> statement-breakpoint
ALTER TABLE "shopping_carts" RENAME CONSTRAINT "shopping_carts_customer_id_customers_id_fkey" TO "shopping_carts_user_id_users_id_fkey";--> statement-breakpoint
ALTER TABLE "shopping_carts" DROP CONSTRAINT "shopping_carts_user_id_users_id_fkey", ADD CONSTRAINT "shopping_carts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "membership" RENAME CONSTRAINT "membership_barbershop_staff_unique" TO "membership_barbershop_user_unique";--> statement-breakpoint
