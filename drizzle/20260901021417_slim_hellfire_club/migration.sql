CREATE TYPE "barbershop_status" AS ENUM('ACTIVE', 'INACTIVE');--> statement-breakpoint
CREATE TYPE "role" AS ENUM('OWNER', 'BARBERMAN');--> statement-breakpoint
CREATE TABLE "barbershop_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"barbershop_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"day_of_week" text NOT NULL,
	"open_time" text NOT NULL,
	"close_time" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "barbershops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"avatarUrl" text,
	"owner_id" uuid NOT NULL,
	"slug" text NOT NULL UNIQUE,
	"cnpj" text NOT NULL UNIQUE,
	"location" text NOT NULL,
	"status" "barbershop_status" DEFAULT 'ACTIVE'::"barbershop_status" NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"barbershop_id" uuid NOT NULL,
	"barberman_id" uuid NOT NULL,
	"shopping_cart_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"avatarUrl" text,
	"email" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"cpf" text NOT NULL UNIQUE,
	"phone_number" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"booking_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"sent_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "service_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"service_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"description" text,
	"price_in_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shopping_carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"service_item_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"total_price_in_cents" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"avatarUrl" text,
	"email" text NOT NULL UNIQUE,
	"password" text NOT NULL,
	"role" "role" NOT NULL,
	"cpf" text NOT NULL UNIQUE,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "barbershop_schedules" ADD CONSTRAINT "barbershop_schedules_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id");--> statement-breakpoint
ALTER TABLE "barbershop_schedules" ADD CONSTRAINT "barbershop_schedules_created_by_staffs_id_fkey" FOREIGN KEY ("created_by") REFERENCES "staffs"("id");--> statement-breakpoint
ALTER TABLE "barbershops" ADD CONSTRAINT "barbershops_owner_id_staffs_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "staffs"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barberman_id_staffs_id_fkey" FOREIGN KEY ("barberman_id") REFERENCES "staffs"("id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_shopping_cart_id_shopping_carts_id_fkey" FOREIGN KEY ("shopping_cart_id") REFERENCES "shopping_carts"("id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id");--> statement-breakpoint
ALTER TABLE "service_items" ADD CONSTRAINT "service_items_service_id_services_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id");--> statement-breakpoint
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_service_item_id_service_items_id_fkey" FOREIGN KEY ("service_item_id") REFERENCES "service_items"("id");--> statement-breakpoint
ALTER TABLE "shopping_carts" ADD CONSTRAINT "shopping_carts_customer_id_customers_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id");