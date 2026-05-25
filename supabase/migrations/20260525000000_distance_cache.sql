-- Migration: Create distance_cache table to optimize Google Maps API calls

CREATE TABLE IF NOT EXISTS public.distance_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_lat_rounded NUMERIC(7,3) NOT NULL,
    origin_lng_rounded NUMERIC(7,3) NOT NULL,
    destination_lat_rounded NUMERIC(7,3) NOT NULL,
    destination_lng_rounded NUMERIC(7,3) NOT NULL,
    distance_km NUMERIC(10,3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create a unique index to easily upsert/conflict resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_distance_cache_route 
ON public.distance_cache (origin_lat_rounded, origin_lng_rounded, destination_lat_rounded, destination_lng_rounded);

-- Enable RLS
ALTER TABLE public.distance_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access (for anon key)
CREATE POLICY "Allow anonymous select on distance_cache" 
ON public.distance_cache FOR SELECT USING (true);

-- Allow public insert access (since the API will run on the serverless function, it could use service role, 
-- but if we use anon key on the backend to insert, we need this)
CREATE POLICY "Allow anonymous insert on distance_cache" 
ON public.distance_cache FOR INSERT WITH CHECK (true);
