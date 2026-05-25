-- pgTAP test for migration 037: memorymedia.thumbnail_path column.

BEGIN;
SELECT plan(3);

SELECT has_column('memorymedia', 'thumbnail_path',
  'memorymedia.thumbnail_path column exists');

SELECT col_type_is('memorymedia', 'thumbnail_path', 'text',
  'thumbnail_path is TEXT');

SELECT col_is_null('memorymedia', 'thumbnail_path',
  'thumbnail_path is nullable');

SELECT * FROM finish();
ROLLBACK;
