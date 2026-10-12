/*
# Fix review_status default to 'not_checked'

## Problem
The review_status column was added with DEFAULT 'ready_for_review', so all 14 existing
drafts got "ready_for_review" without ever being quality-checked. This is misleading —
unchecked entries should show "Not checked" until a recheck is explicitly run.

## Changes
1. Change column default from 'ready_for_review' to 'not_checked'
2. Update all existing drafts that have review_notes = NULL (meaning they were never
   reviewed) to 'not_checked' — entries with review_notes were genuinely reviewed by
   the edge function during extraction.
*/

ALTER TABLE signal_desk_entries ALTER COLUMN review_status SET DEFAULT 'not_checked';

UPDATE signal_desk_entries
SET review_status = 'not_checked'
WHERE status = 'draft' AND review_notes IS NULL AND review_status = 'ready_for_review';
