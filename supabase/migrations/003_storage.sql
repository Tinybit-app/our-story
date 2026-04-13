-- FeatureFlag is read server-side only via the service role key.
-- Enable RLS with no user-facing policies so authenticated clients
-- cannot read or write feature flag config directly.
ALTER TABLE public.FeatureFlag ENABLE ROW LEVEL SECURITY;

-- Private bucket for all user media (no public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memories-private',
  'memories-private',
  false,
  524288000,  -- 500 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
);

-- Storage RLS: only authenticated users can upload to their own path
CREATE POLICY "authenticated users can upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'memories-private' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage RLS: no direct reads — all access via signed URLs from server
CREATE POLICY "no direct reads"
  ON storage.objects FOR SELECT
  USING (false);
