-- Apply AFTER creating the "cvs" bucket in the Supabase Dashboard (Storage UI).
-- Bucket must be PRIVATE. These policies enforce per-user folder isolation.

CREATE POLICY "cvs: upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "cvs: read own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "cvs: delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cvs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
