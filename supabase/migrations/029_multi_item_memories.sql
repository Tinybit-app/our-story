-- supabase/migrations/029_multi_item_memories.sql
-- Multi-item memories: extend MemoryMedia for text slides + ordering + cover

ALTER TABLE memorymedia
  ADD COLUMN text_content TEXT,
  ADD COLUMN display_order INT NOT NULL DEFAULT 0;

ALTER TABLE memorymedia ALTER COLUMN storage_path DROP NOT NULL;
ALTER TABLE memorymedia ALTER COLUMN file_size DROP NOT NULL;

ALTER TABLE memorymedia DROP CONSTRAINT IF EXISTS memorymedia_media_type_check;
ALTER TABLE memorymedia ADD CONSTRAINT memorymedia_media_type_check
  CHECK (media_type IN ('photo', 'video', 'live_photo', 'text'));

ALTER TABLE memorymedia ADD CONSTRAINT memorymedia_content_check
  CHECK (
    (media_type IN ('photo', 'video', 'live_photo') AND storage_path IS NOT NULL) OR
    (media_type = 'text' AND text_content IS NOT NULL)
  );

ALTER TABLE memory
  ADD COLUMN cover_media_id UUID REFERENCES memorymedia(id) ON DELETE SET NULL;

CREATE INDEX idx_memorymedia_memory_order ON memorymedia(memory_id, display_order);
