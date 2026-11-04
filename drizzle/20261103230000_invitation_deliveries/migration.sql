DO $$ BEGIN
  CREATE TYPE "invitation_delivery_status" AS ENUM('PENDING', 'PROCESSING', 'ACCEPTED', 'FAILED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "invitation_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invitation_id" uuid NOT NULL REFERENCES "invitations"("id") ON DELETE CASCADE,
  "barbershop_id" uuid NOT NULL REFERENCES "barbershops"("id") ON DELETE CASCADE,
  "recipient_email" text NOT NULL,
  "recipient_name" text NOT NULL,
  "barbershop_name" text NOT NULL,
  "owner_name" text NOT NULL,
  "token_hash" text NOT NULL,
  "invitation_url" text,
  "status" "invitation_delivery_status" DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "max_attempts" integer DEFAULT 3 NOT NULL,
  "next_attempt_at" timestamp DEFAULT now() NOT NULL,
  "provider_message_id" text,
  "last_error" text,
  "locked_at" timestamp,
  "locked_by" text,
  "processed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invitation_deliveries_status_idx" ON "invitation_deliveries" ("status", "next_attempt_at");
CREATE INDEX IF NOT EXISTS "invitation_deliveries_invitation_idx" ON "invitation_deliveries" ("invitation_id");
