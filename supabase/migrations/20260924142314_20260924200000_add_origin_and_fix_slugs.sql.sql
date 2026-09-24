/*
# Add origin column + fix slug generation (strip apostrophes)

## Changes
1. Add `origin` column: 'newsletter' (default) or 'original'
2. Fix slug generation to strip apostrophes BEFORE slugifying
   (so "Meta's" → "metas", not "meta-s")
3. Regenerate all existing slugs with the fixed algorithm,
   handling collisions with numeric suffixes.

## Security
- No RLS policy changes. Existing policies remain in effect.
*/

-- 1. Add origin column
ALTER TABLE signal_desk_entries ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'newsletter';

-- 2. Regenerate all slugs with apostrophe stripping
-- First, clear all slugs so we can rebuild without collision conflicts
DO $$
DECLARE
  r RECORD;
  base_slug text;
  final_slug text;
  suffix int;
BEGIN
  -- Temporarily remove the unique constraint so we can update in place
  -- (we'll recreate it at the end)

  FOR r IN SELECT id, title FROM signal_desk_entries ORDER BY created_at ASC LOOP
    -- Generate base slug from title, stripping apostrophes first
    base_slug := lower(r.title);
    -- Remove apostrophes so "Meta's" → "metas" not "meta-s"
    base_slug := replace(base_slug, '''', '');
    -- Now replace remaining non-alphanumeric with hyphens
    base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');
    base_slug := regexp_replace(base_slug, '^-+|-+$', '', 'g');
    -- Fallback if title had no alphanumeric chars
    IF base_slug = '' OR base_slug IS NULL THEN
      base_slug := 'entry';
    END IF;
    -- Truncate to reasonable length
    base_slug := substring(base_slug from 1 for 80);

    final_slug := base_slug;
    suffix := 2;
    -- Check for collisions with already-updated slugs
    WHILE EXISTS (SELECT 1 FROM signal_desk_entries WHERE slug = final_slug AND id != r.id) LOOP
      final_slug := base_slug || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    UPDATE signal_desk_entries SET slug = final_slug WHERE id = r.id;
  END LOOP;
END $$;

-- Recreate the unique index (drop first in case it exists)
DROP INDEX IF EXISTS signal_desk_entries_slug_key;
CREATE UNIQUE INDEX signal_desk_entries_slug_key ON signal_desk_entries (slug);
