-- Content Library upload pipeline.
--
-- 1) Storage bucket `content-assets`:
--    - Public read so the in-app player/article view can stream over CDN.
--    - 50 MB file cap (enough for a short audio/video, plus pdfs/images).
--    - Restricted to audio/video/image/pdf/text mime types.
--    - Writes are limited to wellness_admin via RLS on storage.objects.
--
-- 2) Ensure `content_items.asset_url` exists (older migration already created
--    it on the base table — guarded just in case a downstream env never ran
--    that migration).
--
-- 3) Extend the `kind` CHECK to allow 'breath' (the admin UI offers it as a
--    type and falls through to the catch-all icon today, but inserts blow up
--    against the legacy constraint).

-- ── Bucket ─────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'content-assets',
  'content-assets',
  true,
  50 * 1024 * 1024,
  ARRAY['audio/mpeg','audio/mp4','video/mp4','image/png','image/jpeg','application/pdf','text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── storage.objects RLS for the bucket ─────────────────────────────────────
-- Drop legacy policies first so re-runs are idempotent. We intentionally
-- replace the old service-role-only write policies with wellness_admin
-- variants so the admin console can upload directly from the browser using
-- the signed user JWT.
DROP POLICY IF EXISTS "content_assets_public_read"      ON storage.objects;
DROP POLICY IF EXISTS "content_assets_service_write"    ON storage.objects;
DROP POLICY IF EXISTS "content_assets_service_update"   ON storage.objects;
DROP POLICY IF EXISTS "content_assets_service_delete"   ON storage.objects;
DROP POLICY IF EXISTS "content_assets_authed_read"      ON storage.objects;
DROP POLICY IF EXISTS "content_assets_wadmin_write"     ON storage.objects;
DROP POLICY IF EXISTS "content_assets_wadmin_update"    ON storage.objects;
DROP POLICY IF EXISTS "content_assets_wadmin_delete"    ON storage.objects;

-- Anyone authenticated can read (bucket is public anyway, but keep the
-- policy explicit so signed-URL paths and authed clients both work).
CREATE POLICY "content_assets_authed_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets');

CREATE POLICY "content_assets_wadmin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-assets' AND public.is_wellness_admin());

CREATE POLICY "content_assets_wadmin_update"
  ON storage.objects FOR UPDATE
  USING       (bucket_id = 'content-assets' AND public.is_wellness_admin())
  WITH CHECK  (bucket_id = 'content-assets' AND public.is_wellness_admin());

CREATE POLICY "content_assets_wadmin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-assets' AND public.is_wellness_admin());

-- ── content_items.asset_url (safety net) ──────────────────────────────────
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS asset_url TEXT;

-- ── content_items.kind: allow 'breath' ────────────────────────────────────
ALTER TABLE public.content_items DROP CONSTRAINT IF EXISTS content_items_kind_check;
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_kind_check
  CHECK (kind IN ('audio','video','article','breath'));
