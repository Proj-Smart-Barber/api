CREATE TABLE "schedule_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"barbershop_id" uuid NOT NULL,
	"barberman_id" uuid,
	"date" timestamp NOT NULL,
	"start_time" text,
	"end_time" text,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "barbershop_schedules" ADD COLUMN "barberman_id" uuid;--> statement-breakpoint
ALTER TABLE "barbershops" ADD COLUMN "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "date" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "start_time" text NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "end_time" text NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "duration_in_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "barbershop_schedules" ADD CONSTRAINT "barbershop_schedules_barberman_id_staffs_id_fkey" FOREIGN KEY ("barberman_id") REFERENCES "staffs"("id");--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id");--> statement-breakpoint
ALTER TABLE "schedule_exceptions" ADD CONSTRAINT "schedule_exceptions_barberman_id_staffs_id_fkey" FOREIGN KEY ("barberman_id") REFERENCES "staffs"("id");