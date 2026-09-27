/*
# Add 4 tasks to end of Week 1

## Summary
Append 4 additional tasks (sort_order 6-9) to Week 1 of the Senior Games Build Track.

## Tables affected
- lp_tasks: 4 new rows inserted.
*/

DO $$
DECLARE
  w1 uuid;
BEGIN
  SELECT id INTO w1 FROM lp_weeks
  WHERE track_id = '00000000-0000-0000-0000-000000000001' AND week_number = 1;

  INSERT INTO lp_tasks (week_id, title, sort_order) VALUES
    (w1, 'Install Node.js and Python (with Pandas); confirm both run', 6),
    (w1, 'Create free Supabase and Vercel accounts', 7),
    (w1, 'Get a Claude API key from Herb (Clarent account, with a spending limit); store it in a .env file, never in GitHub', 8),
    (w1, 'Check whether your computer is Windows or Mac and tell Herb (for Power BI in Week 8)', 9);
END $$;
