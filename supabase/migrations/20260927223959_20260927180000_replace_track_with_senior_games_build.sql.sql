/*
# Replace sample learning track with "Senior Games Build Track"

## Summary
1. Delete all existing lp_progress rows, lp_tasks, lp_weeks, and lp_tracks
   (test data only — the old "AI Systems Foundations" track).
2. Create the real track: "Senior Games Build Track"
3. Insert 12 weeks with dates and goals.
4. Insert all tasks per week in order using a DO block.

## Tables affected
- lp_tracks, lp_weeks, lp_tasks: existing rows deleted, new rows inserted.
- lp_progress: all rows deleted (test data).
- RLS policies: unchanged.
*/

-- ── 1. Clean up old test data ──────────────────────────
DELETE FROM lp_progress;
DELETE FROM lp_tasks;
DELETE FROM lp_weeks;
DELETE FROM lp_tracks;

-- ── 2. Insert the new track ────────────────────────────
INSERT INTO lp_tracks (id, title, description)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Senior Games Build Track',
  'A 12-week hands-on track: build a social game community for seniors while learning to build, deploy and maintain AI agents and Agent Skills.'
)
ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;

-- ── 3. Insert 12 weeks ─────────────────────────────────
INSERT INTO lp_weeks (track_id, week_number, title, goal, start_date, end_date)
VALUES
  ('00000000-0000-0000-0000-000000000001', 1,  'Setup & first concepts',        'Get your tools running and understand what agents and Skills are.',                 DATE '2026-09-28', DATE '2026-10-04'),
  ('00000000-0000-0000-0000-000000000001', 2,  'First game, solo',               'Build a playable single-player puzzle game with Claude Code.',                      DATE '2026-10-05', DATE '2026-10-11'),
  ('00000000-0000-0000-0000-000000000001', 3,  'Data model & event logging',     'Store every game event so everything can be measured later.',                        DATE '2026-10-12', DATE '2026-10-18'),
  ('00000000-0000-0000-0000-000000000001', 4,  'Accounts & multiplayer',         'Let people sign in, invite friends and play turn-based matches.',                    DATE '2026-10-19', DATE '2026-10-25'),
  ('00000000-0000-0000-0000-000000000001', 5,  'Your first agent: difficulty',   'Build an agent that tunes each player''s difficulty.',                              DATE '2026-10-26', DATE '2026-11-01'),
  ('00000000-0000-0000-0000-000000000001', 6,  'Skills & testing',               'Package reusable Skills and test agent output.',                                    DATE '2026-11-02', DATE '2026-11-08'),
  ('00000000-0000-0000-0000-000000000001', 7,  'Second game & matchmaking',      'Add the speed game and match players well.',                                         DATE '2026-11-09', DATE '2026-11-15'),
  ('00000000-0000-0000-0000-000000000001', 8,  'Family summaries & dashboard',   'Show results to families and to us.',                                                DATE '2026-11-16', DATE '2026-11-22'),
  ('00000000-0000-0000-0000-000000000001', 9,  'Pilot launch',                   'Launch the 4-week pilot with Herb''s mom and about 10 friends.',                    DATE '2026-11-23', DATE '2026-11-29'),
  ('00000000-0000-0000-0000-000000000001', 10, 'Pilot: monitor & fix',           'Keep the agents healthy with real users.',                                           DATE '2026-11-30', DATE '2026-12-06'),
  ('00000000-0000-0000-0000-000000000001', 11, 'Pilot: analysis',                'Measure what''s working.',                                                          DATE '2026-12-07', DATE '2026-12-13'),
  ('00000000-0000-0000-0000-000000000001', 12, 'Wrap-up & portfolio',            'Turn the pilot into results and interview material.',                               DATE '2026-12-14', DATE '2026-12-20');

-- ── 4. Insert tasks using a DO block ───────────────────
DO $$
DECLARE
  w1 uuid; w2 uuid; w3 uuid; w4 uuid; w5 uuid;
  w6 uuid; w7 uuid; w8 uuid; w9 uuid; w10 uuid;
  w11 uuid; w12 uuid;
  tid uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  SELECT id INTO w1  FROM lp_weeks WHERE track_id = tid AND week_number = 1;
  SELECT id INTO w2  FROM lp_weeks WHERE track_id = tid AND week_number = 2;
  SELECT id INTO w3  FROM lp_weeks WHERE track_id = tid AND week_number = 3;
  SELECT id INTO w4  FROM lp_weeks WHERE track_id = tid AND week_number = 4;
  SELECT id INTO w5  FROM lp_weeks WHERE track_id = tid AND week_number = 5;
  SELECT id INTO w6  FROM lp_weeks WHERE track_id = tid AND week_number = 6;
  SELECT id INTO w7  FROM lp_weeks WHERE track_id = tid AND week_number = 7;
  SELECT id INTO w8  FROM lp_weeks WHERE track_id = tid AND week_number = 8;
  SELECT id INTO w9  FROM lp_weeks WHERE track_id = tid AND week_number = 9;
  SELECT id INTO w10 FROM lp_weeks WHERE track_id = tid AND week_number = 10;
  SELECT id INTO w11 FROM lp_weeks WHERE track_id = tid AND week_number = 11;
  SELECT id INTO w12 FROM lp_weeks WHERE track_id = tid AND week_number = 12;

  INSERT INTO lp_tasks (week_id, title, sort_order) VALUES
    (w1, 'Take the call with Ed; tell him you''re acting on his feedback', 1),
    (w1, 'Set up GitHub, VS Code, Claude Code and your Claude Project with the brief', 2),
    (w1, 'Session with Herb: what agents and Skills are', 3),
    (w1, 'Play 3 casual games for an hour each; note what would frustrate a 75-year-old', 4),
    (w1, 'Start your build journal', 5),
    (w2, 'Sketch the game''s screens and review them with Herb', 1),
    (w2, 'Build the first game with large, senior-friendly controls', 2),
    (w2, 'Deploy it to a test URL', 3),
    (w2, 'Journal: what Claude Code did well and where you had to step in', 4),
    (w3, 'Design tables for players, games and game events', 1),
    (w3, 'Set up the Supabase database', 2),
    (w3, 'Log every game started, won, lost and abandoned', 3),
    (w3, 'Write 3 SQL queries: games per day, win rate, average session length', 4),
    (w4, 'Add sign-in and player profiles', 1),
    (w4, 'Invite friends and family by link', 2),
    (w4, 'Turn-based matches between two players', 3),
    (w4, 'Test a full match with Herb', 4),
    (w5, 'Session with Herb: how agents plan, call tools and loop', 1),
    (w5, 'Build the difficulty agent (target 70–80% win rate per player)', 2),
    (w5, 'Connect it to the event data', 3),
    (w5, 'Journal: how the agent decides, and one thing it got wrong', 4),
    (w6, 'Write your first Agent Skill (e.g., generating trivia or word puzzles)', 1),
    (w6, 'Build a test set with known-correct outputs for the difficulty agent', 2),
    (w6, 'Add basic monitoring and a change log', 3),
    (w6, 'Update your resume with real results and send it to Ed', 4),
    (w7, 'Build the speed-of-processing game', 1),
    (w7, 'Build the matchmaking agent (skill, pace, time zone)', 2),
    (w7, 'Add AI opponents for when no one is online', 3),
    (w7, 'Test with 2–3 friends or family members', 4),
    (w8, 'Build the weekly family-summary agent', 1),
    (w8, 'Build the Power BI dashboard: daily players, retention, session length, win rates', 2),
    (w8, 'Privacy check: consent, only needed data, nothing sensitive in the repo', 3),
    (w8, 'Pilot readiness review with Herb', 4),
    (w9, 'Onboard pilot players, with a simple how-to', 1),
    (w9, 'Run the first loneliness and enjoyment check-in', 2),
    (w9, 'Watch the dashboard daily; log issues', 3),
    (w9, 'Journal: first impressions from real players', 4),
    (w10, 'Review agent test results and failures', 1),
    (w10, 'Fix the top 3 issues', 2),
    (w10, 'Tune difficulty based on real win rates', 3),
    (w10, 'Journal: an agent that broke, how you found out, how you fixed it', 4),
    (w11, 'Retention: who keeps coming back, and when people drop off', 1),
    (w11, 'Engagement by game and time of day', 2),
    (w11, 'Second check-in with players', 3),
    (w11, 'Draft 3 findings with supporting charts', 4),
    (w12, 'Write the pilot findings and recommendations', 1),
    (w12, 'Present them to Herb', 2),
    (w12, 'Update your resume and portfolio with final numbers', 3),
    (w12, 'Prepare 3 interview stories from your journal', 4);
END $$;
