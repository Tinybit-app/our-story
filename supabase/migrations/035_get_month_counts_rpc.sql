-- 035_get_month_counts_rpc.sql
-- Returns the count of memories visible to a user in each month within a
-- date window for a given circle. Used by /api/timeline year-branch to
-- show accurate "See all N memories →" overflow counts on the main
-- timeline overview without serializing the whole year of rows.
--
-- Visibility: a memory is visible to the user if it is circle-visibility
-- OR private+owned-by-the-user. Mirrors the .or() filter in
-- /api/timeline.get.ts.

CREATE OR REPLACE FUNCTION public.get_month_counts(
  p_circle_id   UUID,
  p_user_id     UUID,
  p_year_start  TIMESTAMPTZ,
  p_year_end    TIMESTAMPTZ
)
RETURNS TABLE (
  year   INT,
  month  INT,
  count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    EXTRACT(YEAR  FROM date_trunc('month', m.memory_date))::INT  AS year,
    EXTRACT(MONTH FROM date_trunc('month', m.memory_date))::INT AS month,
    COUNT(*)::BIGINT                                            AS count
  FROM public.memory m
  WHERE m.circle_id = p_circle_id
    AND m.memory_date >= p_year_start
    AND m.memory_date <  p_year_end
    AND (
      m.visibility = 'circle'
      OR (m.visibility = 'private' AND m.owner_user_id = p_user_id)
    )
  GROUP BY date_trunc('month', m.memory_date)
  ORDER BY date_trunc('month', m.memory_date) DESC
$$;

GRANT EXECUTE ON FUNCTION public.get_month_counts(UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ)
  TO authenticated;
