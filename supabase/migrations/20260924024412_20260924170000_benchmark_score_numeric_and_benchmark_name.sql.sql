/*
# Signal Desk — benchmark_score as numeric + new benchmark_name column

## Purpose
benchmark_score was a text column storing free-form descriptions like
"46 on Artificial Analysis Intelligence Index". It must be a number so
models can be ranked. A new benchmark_name column records which benchmark
the score came from so models are only compared within the same benchmark.

## Changes
1. Add benchmark_name text column (nullable).
2. Add benchmark_score_num numeric column, populate from text where possible.
3. Drop the old text benchmark_score column.
4. Rename benchmark_score_num to benchmark_score.
*/

ALTER TABLE signal_desk_entries ADD COLUMN benchmark_name text;
ALTER TABLE signal_desk_entries ADD COLUMN benchmark_score_num numeric;

-- Extract numeric value from the text benchmark_score where possible
UPDATE signal_desk_entries
SET benchmark_score_num = (regexp_match(benchmark_score, '([0-9]+(?:\.[0-9]+)?)'))[1]::numeric
WHERE benchmark_score IS NOT NULL
  AND benchmark_score ~ '[0-9]';

-- Extract benchmark name from text like "46 on Artificial Analysis Intelligence Index"
UPDATE signal_desk_entries
SET benchmark_name = regexp_replace(
  regexp_replace(benchmark_score, '^[0-9]+(?:\.[0-9]+)?\s+(?:on\s+|in\s+)?', '', 'i'),
  '\s*$', ''
)
WHERE benchmark_score IS NOT NULL
  AND benchmark_score ~ '[0-9]'
  AND benchmark_score ~* 'on|index|benchmark|score|eval';

-- Move non-numeric benchmark_score text into the summary, then null it out
UPDATE signal_desk_entries
SET summary = summary || E'\n\nBenchmark note: ' || benchmark_score,
    benchmark_score = NULL
WHERE benchmark_score IS NOT NULL
  AND benchmark_score !~ '[0-9]';

-- Move numeric benchmark_score text into the summary too (since we're dropping the text column)
-- but only if the benchmark_name couldn't be extracted
UPDATE signal_desk_entries
SET summary = summary || E'\n\nBenchmark note: ' || benchmark_score,
    benchmark_score = NULL
WHERE benchmark_score IS NOT NULL
  AND benchmark_score_num IS NULL;

-- For rows where we extracted a number, just null the text (number is in _num)
UPDATE signal_desk_entries
SET benchmark_score = NULL
WHERE benchmark_score IS NOT NULL
  AND benchmark_score_num IS NOT NULL;

-- Drop old text column and rename the numeric one
ALTER TABLE signal_desk_entries DROP COLUMN benchmark_score;
ALTER TABLE signal_desk_entries RENAME COLUMN benchmark_score_num TO benchmark_score;
