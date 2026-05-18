/*
  Nashik shop coordinates (approximate, by area from address).
  Run in Supabase → SQL Editor if not applied via CLI.
*/

ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Nashik shops only
UPDATE shops SET latitude = 19.9975, longitude = 73.7898
WHERE id = '4f536e1d-10cb-4713-b28a-26cb634f7a98';

UPDATE shops SET latitude = 19.9528, longitude = 73.7512
WHERE id = 'f82fc288-ada6-49b8-80ce-c0336d4e60e2';

UPDATE shops SET latitude = 20.0145, longitude = 73.8198
WHERE id = '81606c75-97a9-42c1-b516-8395aa93001c';

UPDATE shops SET latitude = 19.9508, longitude = 73.7472
WHERE id = '22f3b091-d608-49fa-9769-732a5c62ad5d';

UPDATE shops SET latitude = 20.0112, longitude = 73.8145
WHERE id = 'e5f399f9-a589-4ae9-86e7-fe2eda4a99b0';

UPDATE shops SET latitude = 19.9515, longitude = 73.7490
WHERE id = '8f7279c8-3db7-4d9f-9204-9a37bdd2a622';

UPDATE shops SET latitude = 19.9488, longitude = 73.7535
WHERE id = '949676f6-1eac-4b3f-8315-0f7eb44b6230';

UPDATE shops SET latitude = 20.0095, longitude = 73.8170
WHERE id = 'c0378c4c-58ca-453b-a8c2-6d0d59db6e8d';

-- Catch any other Nashik-address shops
UPDATE shops SET latitude = 19.9975, longitude = 73.7898
WHERE address ILIKE '%nashik%'
  AND (latitude IS NULL OR longitude IS NULL);
