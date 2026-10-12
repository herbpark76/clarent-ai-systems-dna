-- Flag the Celeris-1 entry as sponsored content for admin review
UPDATE signal_desk_entries
SET review_status = 'needs_attention',
    review_notes = COALESCE(review_notes || '; ', '') || 'Flagged: entry appears to be sponsored content ("Presented by Celeris"). Review and remove if not editorial.'
WHERE title ILIKE '%celeris%' 
  AND status = 'draft'
  AND NOT (review_notes ILIKE '%sponsored%');

-- Flag published use_case entries with no result field for source-based repair
UPDATE signal_desk_entries
SET review_status = 'needs_attention',
    review_notes = COALESCE(review_notes || '; ', '') || 'Flagged: use case has no structured result — run Repair to search the source for an outcome.'
WHERE type = 'use_case'
  AND status = 'published'
  AND (result IS NULL OR result = '')
  AND NOT (review_notes ILIKE '%no structured result%');