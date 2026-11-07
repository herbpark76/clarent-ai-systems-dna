/*
# Switch Senior Games Build Track to React Native + Expo

Data-only update — no rows deleted, no IDs changed.
- Track description updated to mention phone app (React Native + Expo).
- Week 2 title/goal updated to phone focus.
- Week 2 tasks (3 of 4) renamed; journal task unchanged.
- Week 4 tasks (3 of 4) renamed; sign-in task unchanged.
- Week 8 tasks (2 of 4) renamed.
- Week 9 task (1 of 4) renamed.
- Task resources: 2 replaced (Learn React -> Expo, Vercel -> Expo Go),
  2 added (React Native docs, EAS Build),
  3 added on previously resource-less tasks (Expo linking, Expo push, EAS Submit).
- Week 1 untouched. No lp_progress / journal / attachment / quiz rows touched.
- Task count stays 52.
*/

-- (A) Track description
UPDATE lp_tracks
SET description = 'A 12-week hands-on track: build a social mobile game app for seniors (React Native + Expo) while learning to build, deploy and maintain AI agents and Agent Skills.'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- (B) Week 2
UPDATE lp_weeks
SET title = 'First game, on your phone',
    goal  = 'Set up Expo, sketch phone screens, and get a first playable game running on a real phone.'
WHERE id = '65562ed9-a563-44be-bbe5-9b72f8dfac00';

UPDATE lp_tasks SET title = 'Sketch the game''s phone screens (portrait, large tap targets) and review them with Herb'
WHERE id = 'c4ab1faf-d259-45c7-9679-c5825d46c0c3';

UPDATE lp_tasks SET title = 'Set up Expo (create-expo-app, TypeScript) and build the first game in React Native with large, senior-friendly controls'
WHERE id = 'f7e25bf5-f0d8-4296-99b5-b1323f1d890b';

UPDATE lp_tasks SET title = 'Run it on your phone with Expo Go and share a test build with Herb'
WHERE id = '8be7c464-9e70-4c1f-af07-fe4d83cb74fc';

-- (C) Week 4
UPDATE lp_tasks SET title = 'Invite friends and family by link that opens the app (deep link), with a web fallback'
WHERE id = '3759b6dd-68cf-4d14-b2e1-13ab701231fe';

UPDATE lp_tasks SET title = 'Turn-based matches between two players, with a push notification when it''s your turn'
WHERE id = '0e3bea23-4530-45ea-9d90-f104b21209f0';

UPDATE lp_tasks SET title = 'Test a full match with Herb on two phones'
WHERE id = '8371a08a-930d-4194-80d9-041885b58218';

-- (D) Week 8
UPDATE lp_tasks SET title = 'Privacy check: consent, only needed data, app permissions (notifications), nothing sensitive in the repo'
WHERE id = 'f7ab0148-b9df-48e8-bcca-acfa970947f6';

UPDATE lp_tasks SET title = 'Pilot readiness review with Herb, including how pilot players will install the app (TestFlight / Google Play internal testing or the web version)'
WHERE id = '45853fdd-adf1-4786-87da-c9786462e0da';

-- (E) Week 9
UPDATE lp_tasks SET title = 'Onboard pilot players on their phones, with a simple illustrated install and how-to guide'
WHERE id = 'de462f53-a072-4c92-9298-298f5933dabf';

-- (F) Task resources

-- Week 2 "Set up Expo..." task: replace "Learn React" with "Expo: Get started"
UPDATE lp_task_resources
SET title = 'Expo: Get started',
    url   = 'https://docs.expo.dev/get-started/introduction/',
    kind  = 'doc'
WHERE id = '6a6be3f0-8fac-471f-b8d9-5a3a71e98473';

-- Week 2 "Set up Expo..." task: add "React Native docs" (sort_order 2)
INSERT INTO lp_task_resources (task_id, title, url, kind, sort_order)
VALUES ('f7e25bf5-f0d8-4296-99b5-b1323f1d890b', 'React Native docs', 'https://reactnative.dev/docs/getting-started', 'doc', 2);

-- Week 2 "Run it on your phone..." task: replace "Vercel docs" with "Expo Go"
UPDATE lp_task_resources
SET title = 'Expo Go',
    url   = 'https://docs.expo.dev/get-started/expo-go/',
    kind  = 'doc'
WHERE id = '39d87b1a-136b-4da7-af9b-5225bbdc9969';

-- Week 2 "Run it on your phone..." task: add "EAS Build" (sort_order 2)
INSERT INTO lp_task_resources (task_id, title, url, kind, sort_order)
VALUES ('8be7c464-9e70-4c1f-af07-fe4d83cb74fc', 'EAS Build', 'https://docs.expo.dev/build/introduction/', 'doc', 2);

-- Week 4 deep link task: add "Expo linking" (sort_order 1)
INSERT INTO lp_task_resources (task_id, title, url, kind, sort_order)
VALUES ('3759b6dd-68cf-4d14-b2e1-13ab701231fe', 'Expo linking', 'https://docs.expo.dev/linking/overview/', 'doc', 1);

-- Week 4 turn-based task: add "Expo push notifications" (sort_order 1)
INSERT INTO lp_task_resources (task_id, title, url, kind, sort_order)
VALUES ('0e3bea23-4530-45ea-9d90-f104b21209f0', 'Expo push notifications', 'https://docs.expo.dev/push-notifications/overview/', 'doc', 1);

-- Week 9 onboarding task: add "EAS Submit (TestFlight / Play)" (sort_order 1)
INSERT INTO lp_task_resources (task_id, title, url, kind, sort_order)
VALUES ('de462f53-a072-4c92-9298-298f5933dabf', 'EAS Submit (TestFlight / Play)', 'https://docs.expo.dev/submit/introduction/', 'doc', 1);
