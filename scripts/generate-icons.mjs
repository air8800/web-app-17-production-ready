import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PUBLIC = resolve(ROOT, 'public')

const BRAND_BLUE = '#2563eb'
const flatten = { background: BRAND_BLUE }

const faviconSvg = readFileSync(resolve(PUBLIC, 'favicon.svg'))
const maskableSvg = readFileSync(resolve(PUBLIC, 'icon-maskable.svg'))

async function pngFromSvg(svgBuffer, size) {
  return sharp(svgBuffer).resize(size, size).flatten(flatten).png().toBuffer()
}

const targets = [
  { size: 16, file: 'favicon-16.png', svg: faviconSvg },
  { size: 32, file: 'favicon-32.png', svg: faviconSvg },
  { size: 48, file: 'favicon-48.png', svg: faviconSvg },
  { size: 96, file: 'favicon-96.png', svg: faviconSvg },
  { size: 180, file: 'apple-touch-icon.png', svg: faviconSvg },
  { size: 192, file: 'icon-192.png', svg: faviconSvg },
  { size: 512, file: 'icon-512.png', svg: faviconSvg },
  { size: 192, file: 'icon-maskable-192.png', svg: maskableSvg },
  { size: 512, file: 'icon-maskable-512.png', svg: maskableSvg },
]

const ensure = async () => {
  for (const t of targets) {
    const out = resolve(PUBLIC, t.file)
    await sharp(t.svg).resize(t.size, t.size).flatten(flatten).png().toFile(out)
    console.log('Generated', t.file)
  }

  // OG share image
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
      <text x="600" y="590" font-family="Inter, Segoe UI, Arial, sans-serif"
            font-size="28" font-weight="500" fill="#dbeafe" text-anchor="middle">
        Online printing at your nearest shop
      </text>
    </svg>`
  )
  const iconPng = await pngFromSvg(faviconSvg, 360)
  await sharp(ogBg).composite([{ input: iconPng, top: 90, left: 420 }]).png().toFile(resolve(PUBLIC, 'og-image.png'))
  console.log('Generated og-image.png')

  const ico16 = await pngFromSvg(faviconSvg, 16)
  const ico32 = await pngFromSvg(faviconSvg, 32)
  const ico48 = await pngFromSvg(faviconSvg, 48)
  writeFileSync(resolve(PUBLIC, 'favicon.ico'), await pngToIco([ico16, ico32, ico48]))
  console.log('Generated favicon.ico')
}

ensure().catch((err) => {
  console.error(err)
  process.exit(1)
})
