import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const logoSvg = readFileSync(new URL('../public/logo_conectize.svg', import.meta.url))

const logoPng = await sharp(logoSvg)
  .resize(420, 412, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .extend({
    top: 50,
    bottom: 50,
    left: 46,
    right: 46,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .png()
  .toBuffer()

writeFileSync(new URL('../public/logo-conectize.png', import.meta.url), logoPng)

const ogSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071722"/>
      <stop offset="1" stop-color="#0a0a0a"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9FED8D"/>
      <stop offset="1" stop-color="#009FFD"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="18" height="630" fill="url(#bar)"/>
  <g transform="translate(64 150) scale(0.78)">
    ${logoSvg.toString('utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}
  </g>
  <text x="430" y="255" fill="#ffffff" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="72" font-weight="700">Conectize</text>
  <text x="430" y="330" fill="#d5dee6" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="32">Assistência técnica e loja de peças</text>
  <text x="430" y="392" fill="#64cefb" font-family="DejaVu Sans, Liberation Sans, sans-serif" font-size="30">Belo Horizonte</text>
</svg>`

const ogPng = await sharp(Buffer.from(ogSvg)).png().toBuffer()
const meta = await sharp(ogPng).metadata()
if (meta.width !== 1200 || meta.height !== 630) {
  throw new Error(`OG inesperado: ${meta.width}x${meta.height}`)
}
writeFileSync(new URL('../public/og-conectize.png', import.meta.url), ogPng)
console.log('logo', logoPng.length, 'og', ogPng.length, `${meta.width}x${meta.height}`)
