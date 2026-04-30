import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC = resolve(ROOT, 'public')

const svgBuffer = readFileSync(resolve(PUBLIC, 'favicon.svg'))

const targets = [
  { size: 16, file: 'favicon-16.png' },
  { size: 32, file: 'favicon-32.png' },
  { size: 48, file: 'favicon-48.png' },
  { size: 180, file: 'apple-touch-icon.png' },
  { size: 192, file: 'icon-192.png' },
  { size: 512, file: 'icon-512.png' },
  // Open Graph / social share image (square w/ padding)
  { size: 1200, file: 'og-image.png', og: true },
]

const ensure = async () => {
  for (const t of targets) {
    const out = resolve(PUBLIC, t.file)
    if (t.og) {
      // 1200 x 630 with the icon centered on a brand background gradient
      const bg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#2563eb"/>
              <stop offset="100%" stop-color="#4f46e5"/>
            </linearGradient>
          </defs>
          <rect width="1200" height="630" fill="url(#g)"/>
          <text x="600" y="540" font-family="Inter, Segoe UI, Arial, sans-serif"
                font-size="64" font-weight="800" fill="#ffffff" text-anchor="middle">
            PrintGet
          </text>
          <text x="600" y="590" font-family="Inter, Segoe UI, Arial, sans-serif"
                font-size="28" font-weight="500" fill="#dbeafe" text-anchor="middle">
            Online printing at your nearest shop
          </text>
        </svg>`
      )
      const iconPng = await sharp(svgBuffer).resize(360, 360).png().toBuffer()
      await sharp(bg)
        .composite([{ input: iconPng, top: 90, left: 420 }])
        .png()
        .toFile(out)
      console.log('Generated', t.file)
      continue
    }
    await sharp(svgBuffer).resize(t.size, t.size).png().toFile(out)
    console.log('Generated', t.file)
  }

  // Generate a multi-resolution favicon.ico (16, 32, 48) from PNG buffers
  const ico16 = await sharp(svgBuffer).resize(16, 16).png().toBuffer()
  const ico32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer()
  const ico48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer()
  const icoBuffer = await pngToIco([ico16, ico32, ico48])
  writeFileSync(resolve(PUBLIC, 'favicon.ico'), icoBuffer)
  console.log('Generated favicon.ico')
}

ensure().catch((err) => {
  console.error(err)
  process.exit(1)
})
