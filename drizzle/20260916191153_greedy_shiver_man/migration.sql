CREATE TABLE "membership" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"role" "role" DEFAULT 'OWNER'::"role" NOT NULL,
	"barbershop_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staffs" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_staff_id_staffs_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staffs"("id") ON DELETE CASCADE;