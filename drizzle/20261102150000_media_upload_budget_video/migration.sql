CREATE TABLE IF NOT EXISTS media_upload_reservations(media_id uuid PRIMARY KEY,scope uuid NOT NULL,bytes bigint NOT NULL CHECK(bytes>0),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS media_video_jobs(media_id uuid PRIMARY KEY REFERENCES media(id),state text NOT NULL DEFAULT 'PENDING',attempts integer NOT NULL DEFAULT 0,lease_until timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE media_upload_reservations ADD COLUMN IF NOT EXISTS staging_key text;
