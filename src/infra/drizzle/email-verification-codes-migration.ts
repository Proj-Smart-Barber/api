/** Additive migration: legacy email verification links remain intact. */
export const emailVerificationCodesMigration = `
CREATE TABLE IF NOT EXISTS email_verification_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 code_hash text NOT NULL,
 expires_at timestamptz NOT NULL,
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_codes_user_created_idx
 ON email_verification_codes(user_id,created_at);
`;
