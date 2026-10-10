CREATE TYPE "invitation_status" AS ENUM('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"barbershop_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "role" DEFAULT 'BARBERMAN'::"role" NOT NULL,
	"token_hash" text NOT NULL UNIQUE,
	"status" "invitation_status" DEFAULT 'PENDING'::"invitation_status" NOT NULL,
	"expires_at" timestamp NOT NULL,
	"invited_by_id" uuid NOT NULL,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "invitations_barbershop_email_idx" ON "invitations" ("barbershop_id","email");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" ("status");--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_barbershop_id_barbershops_id_fkey" FOREIGN KEY ("barbershop_id") REFERENCES "barbershops"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_id_users_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id");