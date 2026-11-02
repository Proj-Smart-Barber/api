CREATE TABLE IF NOT EXISTS service_media (
 service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
 media_id uuid NOT NULL REFERENCES media(id),
 display_order integer NOT NULL DEFAULT 0 CHECK(display_order >= 0),
 PRIMARY KEY(service_id,media_id)
);
