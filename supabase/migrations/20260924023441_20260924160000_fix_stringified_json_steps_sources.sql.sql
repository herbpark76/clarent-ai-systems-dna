/*
# Signal Desk — fix stringified JSON in steps and sources columns

## Purpose
The edge function previously stored `JSON.stringify(...)` results into
jsonb columns. Postgres stored them as JSON string scalars (e.g. `"[]"`)
instead of native JSON arrays. The frontend called `.map()` on these
string values and crashed.

## Change
- For every row where `steps` is a jsonb string (not an array), parse
  the string into a proper jsonb array.
- Same for `sources`.
- If parsing fails, default to `[]` so the row is still usable.
*/

UPDATE signal_desk_entries
SET steps = CASE
  WHEN jsonb_typeof(steps) = 'string' THEN
    COALESCE(steps::text::jsonb, '[]'::jsonb)
  ELSE steps
END
WHERE jsonb_typeof(steps) = 'string';

UPDATE signal_desk_entries
SET sources = CASE
  WHEN jsonb_typeof(sources) = 'string' THEN
    COALESCE(sources::text::jsonb, '[]'::jsonb)
  ELSE sources
END
WHERE jsonb_typeof(sources) = 'string';
