/*
  Shop coordinates for distance / directions on the shop list.
  Run in Supabase SQL Editor (same project as VITE_SUPABASE_URL).

  Coordinates are approximate points matching each shop address area
  (Nashik: Konark Nagar, Adgaon; Pune: Viman Nagar, Magarpatta).
*/

-- Ensure columns exist (skip if you already added them)
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Nashik & Pune active shops (IDs from production data)
UPDATE shops SET latitude = 19.9975, longitude = 73.7898
WHERE id = '4f536e1d-10cb-4713-b28a-26cb634f7a98'; -- shivam (Nashik)

UPDATE shops SET latitude = 19.9528, longitude = 73.7512
WHERE id = 'f82fc288-ada6-49b8-80ce-c0336d4e60e2'; -- Omkar Digital Print, Konark Nagar Phase 2

UPDATE shops SET latitude = 20.0145, longitude = 73.8198
WHERE id = '81606c75-97a9-42c1-b516-8395aa93001c'; -- Siddhi Xerox Centre, Adgaon Road

UPDATE shops SET latitude = 19.9508, longitude = 73.7472
WHERE id = '22f3b091-d608-49fa-9769-732a5c62ad5d'; -- Balaji Print Studio, Konark Nagar Main Road

UPDATE shops SET latitude = 20.0112, longitude = 73.8145
WHERE id = 'e5f399f9-a589-4ae9-86e7-fe2eda4a99b0'; -- Shubham Stationery & Xerox, Adgaon

UPDATE shops SET latitude = 19.9515, longitude = 73.7490
WHERE id = '8f7279c8-3db7-4d9f-9204-9a37bdd2a622'; -- Mauli Copy Centre, Konark Nagar Chowk

UPDATE shops SET latitude = 19.9488, longitude = 73.7535
WHERE id = '949676f6-1eac-4b3f-8315-0f7eb44b6230'; -- Nakoda Xerox, Ambad Link / Konark Nagar Gate

UPDATE shops SET latitude = 20.0095, longitude = 73.8170
WHERE id = 'c0378c4c-58ca-453b-a8c2-6d0d59db6e8d'; -- Jai Shree Xerox, Adgaon Shivar

UPDATE shops SET latitude = 18.5676, longitude = 73.9142
WHERE id = '69e89e19-21af-4e3d-894e-4f492973516a'; -- Swaraj Digital Studio, Viman Nagar, Pune

UPDATE shops SET latitude = 18.5158, longitude = 73.9312
WHERE id = '0c556f1f-bb0d-4f60-87a4-42bd76d02f5d'; -- Annapurna Xerox Hub, Magarpatta / Hadapsar, Pune
