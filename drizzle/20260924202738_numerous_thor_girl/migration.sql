UPDATE "barbershops" SET "cnpj" = regexp_replace("cnpj", '[^0-9]', '', 'g');--> statement-breakpoint
ALTER TABLE "membership" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "membership" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_barbershop_staff_unique" UNIQUE("barbershop_id","staff_id");