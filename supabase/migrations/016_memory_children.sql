-- Junction table: which children are tagged in a given memory.
-- Replaces the blunt "show all children on all memories" approach with
-- per-memory child tagging at upload time (and editable afterwards).

CREATE TABLE public.memory_children (
  memory_id UUID NOT NULL REFERENCES public.memory(id) ON DELETE CASCADE,
  child_id  UUID NOT NULL REFERENCES public.childprofile(id) ON DELETE CASCADE,
  PRIMARY KEY (memory_id, child_id)
);

ALTER TABLE public.memory_children ENABLE ROW LEVEL SECURITY;

-- Members can read tagged children for any memory they can see
CREATE POLICY "members can read memory_children" ON public.memory_children
  FOR SELECT USING (
    memory_id IN (
      SELECT m.id FROM public.memory m
      JOIN public.circlemember cm ON cm.circle_id = m.circle_id
      WHERE cm.user_id = auth.uid()
        AND (m.visibility = 'circle' OR m.owner_user_id = auth.uid())
    )
  );

-- Only the memory owner can tag or untag children
CREATE POLICY "owner can insert memory_children" ON public.memory_children
  FOR INSERT WITH CHECK (
    memory_id IN (SELECT id FROM public.memory WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner can delete memory_children" ON public.memory_children
  FOR DELETE USING (
    memory_id IN (SELECT id FROM public.memory WHERE owner_user_id = auth.uid())
  );
