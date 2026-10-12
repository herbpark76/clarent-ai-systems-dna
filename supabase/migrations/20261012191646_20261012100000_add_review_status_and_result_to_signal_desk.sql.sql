/*
# Add content quality review and result columns to signal_desk_entries

## Summary
Adds content quality review fields and a dedicated result field for use case entries.

## New Columns on signal_desk_entries
- `review_status` (text, not null, default 'ready_for_review') — content quality label:
  'ready_for_review' = passed all automated checks
  'needs_attention' = flagged by automated quality checks
  'draft' = legacy/default for entries not yet reviewed (blank entries, manual edits)
- `review_notes` (text, nullable) — short human-readable reasons for any quality flags
  (e.g. "Tutorial has no steps", "Title has newsletter prefix", "Possible misclassification: Tool → News")
- `result` (text, nullable) — for use_case entries: the outcome achieved (Problem/Tool/Steps/Result structure)

## Security
No changes to RLS. Existing policies remain in place.

## Important Notes
1. The `review_status` column uses a text type (not enum) so new statuses can be added without migrations.
2. Existing draft rows get 'ready_for_review' as the default — admins can re-run checks via the "Recheck drafts" action.
3. The `result` column is nullable and only populated for use_case entries.
*/

ALTER TABLE signal_desk_entries
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'ready_for_review',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS result text;
