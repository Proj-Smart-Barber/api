DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_state') THEN
    CREATE TYPE "membership_state" AS ENUM ('ACTIVE', 'INACTIVE');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_attempt_state') THEN
    CREATE TYPE "operation_attempt_state" AS ENUM ('PENDING', 'APPLIED', 'NOT_APPLIED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operation_resource_kind') THEN
    CREATE TYPE "operation_resource_kind" AS ENUM ('BOOKING', 'MEMBERSHIP', 'REGISTRATION', 'INVITATION');
  END IF;
END $$;

ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "state" "membership_state" DEFAULT 'ACTIVE' NOT NULL;
ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
ALTER TABLE "membership" ADD COLUMN IF NOT EXISTS "ended_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "membership_barbershop_state_created_idx"
ON "membership" ("barbershop_id", "state", "created_at", "id");

CREATE TABLE IF NOT EXISTS "operation_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL,
  "request_id" text NOT NULL,
  "operation" text NOT NULL,
  "payload_hash" text NOT NULL,
  "state" "operation_attempt_state" DEFAULT 'PENDING' NOT NULL,
  "resource_kind" "operation_resource_kind",
  "resource_id" text,
  "resource_version" integer,
  "response_payload" text,
  "terminal_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "operation_attempts_actor_request_unique" UNIQUE ("actor_id", "request_id"),
  CONSTRAINT "operation_attempts_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "operation_attempts_actor_request_idx"
ON "operation_attempts" ("actor_id", "request_id");
CREATE INDEX IF NOT EXISTS "operation_attempts_expires_at_idx"
ON "operation_attempts" ("expires_at");
