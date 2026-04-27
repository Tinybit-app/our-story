-- 024_viewer_link.sql
-- Viewer links: owner-generated share links for read-only circle access.
-- Each link has a nonce for instant revocation. Three modes: full, date_range, selection.

CREATE TABLE public.viewer_link (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id          UUID NOT NULL REFERENCES public.circle(id) ON DELETE CASCADE,
  nonce              UUID NOT NULL DEFAULT gen_random_uuid(),
  mode               TEXT NOT NULL CHECK (mode IN ('full', 'date_range', 'selection')),
  memory_ids         UUID[],              -- selection mode only; NULL otherwise
  date_from          DATE,                -- date_range mode only; NULL otherwise
  date_to            DATE,                -- date_range mode only; NULL otherwise
  label              TEXT NOT NULL,
  expires_at         TIMESTAMPTZ NOT NULL,
  notified_expiry_at TIMESTAMPTZ,         -- set when 3-day warning email is sent
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON public.viewer_link (circle_id);
CREATE INDEX ON public.viewer_link (id, nonce);

ALTER TABLE public.viewer_link ENABLE ROW LEVEL SECURITY;

-- Only the circle owner can manage viewer links for their circle
CREATE POLICY "owner can select own circle viewer links"
  ON public.viewer_link FOR SELECT
  USING (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner'])
    )
  );

CREATE POLICY "owner can insert viewer links for own circle"
  ON public.viewer_link FOR INSERT
  WITH CHECK (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner'])
    )
  );

CREATE POLICY "owner can delete own circle viewer links"
  ON public.viewer_link FOR DELETE
  USING (
    circle_id IN (
      SELECT public.get_my_circle_ids_as_role(ARRAY['owner'])
    )
  );
