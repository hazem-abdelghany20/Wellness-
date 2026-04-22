-- Storage bucket policies
-- Buckets are created in config.toml; policies go here

-- content-assets bucket: public read, service_role write
CREATE POLICY "content_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'content-assets');

CREATE POLICY "content_assets_service_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'content-assets' AND auth.role() = 'service_role');

CREATE POLICY "content_assets_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'content-assets' AND auth.role() = 'service_role');

CREATE POLICY "content_assets_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'content-assets' AND auth.role() = 'service_role');

-- company-assets bucket: company members read, company_admin write
CREATE POLICY "company_assets_member_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'company_id')
  );

CREATE POLICY "company_assets_admin_write"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'company-assets'
    AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'company_id')
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('company_admin', 'hr_admin')
  );

CREATE POLICY "company_assets_service_all"
  ON storage.objects
  USING (bucket_id = 'company-assets' AND auth.role() = 'service_role');
