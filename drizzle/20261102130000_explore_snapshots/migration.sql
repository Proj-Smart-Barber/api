CREATE TABLE IF NOT EXISTS explore_feed_snapshots (
 id uuid PRIMARY KEY, filters_hash text NOT NULL, ordered_ids jsonb NOT NULL,
 expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS explore_feed_snapshots_expiry_idx ON explore_feed_snapshots(expires_at);
