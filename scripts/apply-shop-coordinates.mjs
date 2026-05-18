/**
 * Applies shop lat/lng via Supabase REST (needs SUPABASE_SERVICE_ROLE_KEY in .env).
 * Alternative: run supabase/migrations/20250518000000_shop_coordinates.sql in SQL Editor.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env')
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : ''

const get = (key) => {
  const m = env.match(new RegExp(`^${key}=(.+)$`, 'm'))
  return m ? m[1].trim() : process.env[key]
}

const url = get('VITE_SUPABASE_URL') || get('SUPABASE_URL')
const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY')

const updates = [
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

if (!url || !serviceKey) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env, or run the SQL migration in Supabase Dashboard.')
  process.exit(1)
}

for (const row of updates) {
  const res = await fetch(`${url}/rest/v1/shops?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ latitude: row.latitude, longitude: row.longitude }),
  })
  if (!res.ok) {
    console.error(`Failed ${row.id}:`, await res.text())
    process.exit(1)
  }
  console.log(`Updated ${row.id}`)
}

console.log('Done.')
