import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(__dirname, '..', 'public')

const svgBuffer = readFileSync(resolve(PUBLIC, 'favicon.svg'))

/** Rasterize SVG at 2–4× target size so small tab icons stay crisp */
const renderPng = (size) =>
  sharp(svgBuffer, { density: Math.min(384, Math.max(192, size * 3)) })
    .resize(size, size)
    .png({ compressionLevel: 9, adaptiveFiltering: true })

const targets = [
  { size: 16, file: 'favicon-16.png' },
  { size: 32, file: 'favicon-32.png' },
  { size: 48, file: 'favicon-48.png' },
  { size: 96, file: 'favicon-96.png' },
  { size: 180, file: 'apple-touch-icon.png' },
  { size: 192, file: 'icon-192.png' },
  { size: 512, file: 'icon-512.png' },
  { size: 192, file: 'icon-maskable-192.png' },
  { size: 512, file: 'icon-maskable-512.png' },
]

const ensure = async () => {
  for (const t of targets) {
    await renderPng(t.size).toFile(resolve(PUBLIC, t.file))
    console.log('Generated', t.file)
  }

  const ogBg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#2563eb"/>
          <stop offset="100%" stop-color="#4f46e5"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#g)"/>
      <text x="600" y="540" font-family="Inter, Segoe UI, Arial, sans-serif"
            font-size="64" font-weight="800" fill="#ffffff" text-anchor="middle">PrintGet</text>
    </svg>`
  )
  const iconPng = await renderPng(360).toBuffer()
  await sharp(ogBg).composite([{ input: iconPng, top: 90, left: 420 }]).png().toFile(resolve(PUBLIC, 'og-image.png'))
  console.log('Generated og-image.png')

  const ico16 = await renderPng(16).toBuffer()
  const ico32 = await renderPng(32).toBuffer()
  const ico48 = await renderPng(48).toBuffer()
  writeFileSync(resolve(PUBLIC, 'favicon.ico'), await pngToIco([ico16, ico32, ico48]))
  console.log('Generated favicon.ico')
}

ensure().catch((err) => {
  console.error(err)
  process.exit(1)
})
