-- When a circle member is removed with keepContent=true, we NULL out
-- owner_user_id to detach the memory from the account. We also snapshot
-- the member's display name here so cards can still show a greyed-out
-- attribution ("posted by Sarah") after they leave.
ALTER TABLE public.Memory ADD COLUMN former_owner_name TEXT;
