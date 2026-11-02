ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "image_url" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "is_featured" boolean DEFAULT false NOT NULL;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "featured_order" integer DEFAULT 0 NOT NULL;
