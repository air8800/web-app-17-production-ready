-- Separate cached distances by routing provider (Google vs Ola return different routes).

ALTER TABLE public.distance_cache
  ADD COLUMN IF NOT EXISTS routing_provider text NOT NULL DEFAULT 'ola';

DROP INDEX IF EXISTS idx_distance_cache_route;

CREATE UNIQUE INDEX IF NOT EXISTS idx_distance_cache_route
ON public.distance_cache (
  routing_provider,
  origin_lat_rounded,
  origin_lng_rounded,
  destination_lat_rounded,
  destination_lng_rounded
);
