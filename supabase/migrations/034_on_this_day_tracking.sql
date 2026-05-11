-- 034_on_this_day_tracking.sql
-- Track the last time a "memory from your first month" fallback was sent for a circle,
-- to enforce the once-per-week cap when the circle is below the On This Day threshold.

ALTER TABLE public.Circle
  ADD COLUMN last_first_month_memory_sent_at TIMESTAMPTZ;
