/*
# Signal Desk — duplicate detection + multi-source support

## Purpose
1. Allow entries to have multiple sources (sources jsonb array).
2. Track duplicate relationships between entries so the admin can merge,
   keep separate, or discard potential duplicates.
3. Add an index on model_name for the Model Tracker (most recent per model).

## Changes to signal_desk_entries
- ADD COLUMN `sources` jsonb NOT NULL DEFAULT '[]'::jsonb
  Array of { name, date, url } objects. The original scalar source_name,
  source_date, source_url columns are kept for backwards compatibility —
  new rows populate both, and the admin UI reads from `sources` with a
  fallback to the scalar fields.
- ADD COLUMN `duplicate_of` uuid REFERENCES signal_desk_entries(id) ON DELETE SET NULL
  When Claude flags a possible duplicate, the new draft is saved with
  duplicate_of set to the existing entry's id. NULL means not a duplicate.
- ADD COLUMN `duplicate_status` text NOT NULL DEFAULT 'none'
  CHECK in ('none', 'possible', 'merged', 'separate', 'discarded')
  Tracks the admin's decision on a flagged duplicate.
- ADD INDEX idx_signal_desk_entries_model_name on model_name (for Model Tracker)
- ADD INDEX idx_signal_desk_entries_duplicate_of on duplicate_of

## Security
- No RLS policy changes — the existing admin-gated policies cover the new columns.
- The `sources`, `duplicate_of`, and `duplicate_status` columns inherit the
  existing column-level grants (all columns are updatable by authenticated admin).
*/

-- ── sources jsonb array ────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signal_desk_entries' AND column_name = 'sources'
  ) THEN
    ALTER TABLE signal_desk_entries
      ADD COLUMN sources jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ── duplicate_of ───────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signal_desk_entries' AND column_name = 'duplicate_of'
  ) THEN
    ALTER TABLE signal_desk_entries
      ADD COLUMN duplicate_of uuid REFERENCES signal_desk_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── duplicate_status ───────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'signal_desk_entries' AND column_name = 'duplicate_status'
  ) THEN
    ALTER TABLE signal_desk_entries
      ADD COLUMN duplicate_status text NOT NULL DEFAULT 'none'
      CHECK (duplicate_status IN ('none', 'possible', 'merged', 'separate', 'discarded'));
  END IF;
END $$;

-- ── Indexes ────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_signal_desk_entries_model_name
  ON signal_desk_entries (model_name)
  WHERE model_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_signal_desk_entries_duplicate_of
  ON signal_desk_entries (duplicate_of)
  WHERE duplicate_of IS NOT NULL;
