/**
 * One-time: writes shop latitude/longitude to Supabase (service role).
 * POST with header x-seed-secret matching SHOP_COORDS_SEED_SECRET in Vercel.
 * Or run supabase/migrations/20250518000000_shop_coordinates.sql in SQL Editor.
 */
import { createClient } from '@supabase/supabase-js'

const UPDATES = [
  { id: '4f536e1d-10cb-4713-b28a-26cb634f7a98', latitude: 19.9975, longitude: 73.7898 },
  { id: 'f82fc288-ada6-49b8-80ce-c0336d4e60e2', latitude: 19.9528, longitude: 73.7512 },
  { id: '81606c75-97a9-42c1-b516-8395aa93001c', latitude: 20.0145, longitude: 73.8198 },
  { id: '22f3b091-d608-49fa-9769-732a5c62ad5d', latitude: 19.9508, longitude: 73.7472 },
  { id: 'e5f399f9-a589-4ae9-86e7-fe2eda4a99b0', latitude: 20.0112, longitude: 73.8145 },
  { id: '8f7279c8-3db7-4d9f-9204-9a37bdd2a622', latitude: 19.9515, longitude: 73.7490 },
  { id: '949676f6-1eac-4b3f-8315-0f7eb44b6230', latitude: 19.9488, longitude: 73.7535 },
  { id: 'c0378c4c-58ca-453b-a8c2-6d0d59db6e8d', latitude: 20.0095, longitude: 73.8170 },
  { id: '69e89e19-21af-4e3d-894e-4f492973516a', latitude: 18.5676, longitude: 73.9142 },
  { id: '0c556f1f-bb0d-4f60-87a4-42bd76d02f5d', latitude: 18.5158, longitude: 73.9312 },
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.SHOP_COORDS_SEED_SECRET
  if (!secret || req.headers['x-seed-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' })
  }

  const supabase = createClient(url, key)
  const results = []

  for (const row of UPDATES) {
    const { error } = await supabase
      .from('shops')
      .update({ latitude: row.latitude, longitude: row.longitude })
      .eq('id', row.id)

    results.push({ id: row.id, ok: !error, error: error?.message })
  }

  return res.status(200).json({ updated: results.filter((r) => r.ok).length, results })
}
