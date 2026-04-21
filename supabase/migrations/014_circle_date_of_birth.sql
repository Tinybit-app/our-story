-- Add date_of_birth to Circle (baby age stamp — build plan §4.10.1)
-- Nullable: only relevant for circles that want the baby age stamp feature.
-- Stored as DATE (no time component needed — just the calendar date of birth).

ALTER TABLE public.Circle
  ADD COLUMN date_of_birth DATE;

COMMENT ON COLUMN public.Circle.date_of_birth IS
  'Optional birth date for computing baby age stamps on memory cards (§4.10.1). '
  'Leave NULL to hide age stamps. Owner/admin can set via PATCH /api/circles/:id.';
