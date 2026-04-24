-- 0008_profile_area.sql
-- Adds avatar columns to profiles, display_name to cvs, and storage policies
-- for the new public `avatars` bucket. The bucket itself MUST be created
-- manually in the Supabase Dashboard (Storage → New bucket → Public).

ALTER TABLE public.profiles
  ADD COLUMN avatar_url TEXT,
  ADD COLUMN avatar_updated_at TIMESTAMPTZ;

ALTER TABLE public.cvs
  ADD COLUMN display_name TEXT;

-- Storage policies for `avatars` bucket
CREATE POLICY "avatars: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars: upload own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: update own folder"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "avatars: delete own folder"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
