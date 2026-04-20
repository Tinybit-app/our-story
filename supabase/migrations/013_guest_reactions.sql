-- §4.5 Guest reactions: allow viewer-role users to react without a Supabase account.
-- Design spec: "user_id nullable — NULL for guest reactions from the email digest
-- one-tap link or viewer-role page; set in Phase 1 Milestone 12.1 migration"
--
-- Changes:
--   1. Make MemoryReaction.user_id nullable so guest rows (no account) can be inserted.
--   2. Add guest_name column for display purposes ("Grandma Sue reacted ❤").
--   3. Drop the existing UNIQUE(memory_id, user_id, emoji) constraint — it can't
--      cover NULL user_id rows correctly. Replace with a partial unique index that
--      still prevents duplicate authenticated reactions while allowing multiple
--      guest reactions on the same memory.

-- Step 1: drop the old unique constraint
ALTER TABLE public.MemoryReaction
  DROP CONSTRAINT IF EXISTS memoryreaction_memory_id_user_id_emoji_key;

-- Step 2: make user_id nullable
ALTER TABLE public.MemoryReaction
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: add guest_name column
ALTER TABLE public.MemoryReaction
  ADD COLUMN IF NOT EXISTS guest_name TEXT;

-- Step 4: re-add uniqueness only for authenticated users (user_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS memoryreaction_auth_unique
  ON public.MemoryReaction (memory_id, user_id, emoji)
  WHERE user_id IS NOT NULL;
