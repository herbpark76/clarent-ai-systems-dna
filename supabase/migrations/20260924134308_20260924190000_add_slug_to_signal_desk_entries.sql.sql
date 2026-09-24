/*
# Add slug column to signal_desk_entries

## Purpose
Each entry needs a unique, URL-friendly slug generated from its title for
individual entry pages at /signal-desk/:slug.

## Changes
1. Add `slug` column (text, nullable initially, then NOT NULL after backfill).
2. Add a unique index on slug.
3. Backfill all existing rows with a slug derived from the title:
   - Lowercase, replace non-alphanumeric with hyphens, collapse multiple hyphens, trim leading/trailing hyphens.
   - If the base slug collides with an existing slug, append a short suffix (-2, -3, ...).
4. Set slug NOT NULL so every entry has one going forward.

## Security
- No RLS policy changes. Existing policies remain in effect.
*/

ALTER TABLE signal_desk_entries ADD COLUMN IF NOT EXISTS slug text;

-- Backfill: generate slugs from titles, handling collisions per-row
DO $$
DECLARE
  r RECORD;
  base_slug text;
  final_slug text;
  suffix int;
BEGIN
  FOR r IN SELECT id, title FROM signal_desk_entries WHERE slug IS NULL LOOP
    -- Generate base slug from title
    base_slug := lower(r.title);
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
    -- Check for collisions with already-assigned slugs
    WHILE EXISTS (SELECT 1 FROM signal_desk_entries WHERE slug = final_slug AND id != r.id) LOOP
      final_slug := base_slug || '-' || suffix::text;
      suffix := suffix + 1;
    END LOOP;

    UPDATE signal_desk_entries SET slug = final_slug WHERE id = r.id;
  END LOOP;
END $$;

-- Now that all rows have slugs, set NOT NULL
ALTER TABLE signal_desk_entries ALTER COLUMN slug SET NOT NULL;

-- Unique index for slug lookups
CREATE UNIQUE INDEX IF NOT EXISTS signal_desk_entries_slug_key ON signal_desk_entries (slug);
