-- memory_members: per-memory member tagging (who appears in a photo/video)
-- Mirrors memory_children: uploader-owns semantics, members can read.

CREATE TABLE public.memory_members (
  memory_id UUID NOT NULL REFERENCES public.memory(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id)   ON DELETE CASCADE,
  PRIMARY KEY (memory_id, user_id)
);

ALTER TABLE public.memory_members ENABLE ROW LEVEL SECURITY;

-- Circle members can read memory_members for memories they are allowed to see
CREATE POLICY "members can read memory_members" ON public.memory_members
  FOR SELECT USING (
    memory_id IN (
      SELECT m.id FROM public.memory m
      JOIN public.circlemember cm ON cm.circle_id = m.circle_id
      WHERE cm.user_id = auth.uid()
        AND (m.visibility = 'circle' OR m.owner_user_id = auth.uid())
    )
  );

-- Only the memory uploader (owner_user_id) can insert member tags
CREATE POLICY "uploader can insert memory_members" ON public.memory_members
  FOR INSERT WITH CHECK (
    memory_id IN (SELECT id FROM public.memory WHERE owner_user_id = auth.uid())
  );

-- Only the memory uploader can delete member tags (needed for replace-all re-tagging)
CREATE POLICY "uploader can delete memory_members" ON public.memory_members
  FOR DELETE USING (
    memory_id IN (SELECT id FROM public.memory WHERE owner_user_id = auth.uid())
  );
