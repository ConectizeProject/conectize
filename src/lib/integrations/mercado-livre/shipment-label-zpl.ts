import { unzipSync } from 'fflate'

export type SkuLabelItem = {
  sku: string | null
  quantity: number
}

function escapeZplText (value: string) {
  return value
    .replace(/\^/g, ' ')
    .replace(/~/g, ' ')
    .replace(/\r?\n/g, ' ')
    .trim()
}

export function formatSkuLabelText (items: SkuLabelItem[]): string | null {
  const parts: string[] = []
  for (const item of items) {
    const sku = String(item.sku || '').trim()
    if (!sku) continue
    const quantity = Math.max(1, Math.trunc(Number(item.quantity) || 1))
    parts.push(quantity > 1 ? `${quantity} x ${sku}` : sku)
  }
  if (parts.length === 0) return null
  return `SKUs: ${parts.join('; ')}`
}

export function formatNfFooterText (input: {
  series?: string | number | null
  number?: string | number | null
  accessKey?: string | null
}): string | null {
  const series = String(input.series ?? '').trim()
  const number = String(input.number ?? '').trim()
  const accessKey = String(input.accessKey ?? '').replace(/\D/g, '')
  const parts: string[] = []
  if (series && number) parts.push(`NF-e Série ${series} · Nº ${number}`)
  else if (number) parts.push(`NF-e Nº ${number}`)
  if (accessKey.length >= 8) parts.push(accessKey.slice(-8))
  if (parts.length === 0) return null
  return parts.join(' · ')
}

function parseZplDimension (zpl: string, command: string): number | null {
  const match = zpl.match(new RegExp(`\\^${command}(\\d+)`, 'i'))
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value > 0 ? value : null
}

/** Índice do primeiro ^XZ (etiqueta de envio). MELI manda várias páginas no mesmo ZPL. */
function firstXzIndex (zpl: string): number {
  return zpl.toUpperCase().indexOf('^XZ')
}

function firstLabelSlice (zpl: string): string {
  const xzIndex = firstXzIndex(zpl)
  return xzIndex < 0 ? zpl : zpl.slice(0, xzIndex)
}

/**
 * Insere na 1ª etiqueta (antes do primeiro ^XZ).
 * Inserir no último ^XZ coloca o texto na página de DANFE/dados adicionais,
 * que a prévia Labelary (índice 0) não mostra.
 */
function insertBeforeFirstXz (zpl: string, snippet: string): string {
  const trimmed = zpl.replace(/\s+$/, '')
  const xzIndex = firstXzIndex(trimmed)
  if (xzIndex < 0) return `${trimmed}\n${snippet}\n^XZ\n`
  return `${trimmed.slice(0, xzIndex)}${snippet}\n${trimmed.slice(xzIndex)}`
}

/** Preenche/acrescenta no campo DADOS ADICIONAIS (páginas seguintes do ZPL MELI). */
export function fillDadosAdicionais (zpl: string, text: string): string {
  const escaped = escapeZplText(text)
  if (!escaped) return zpl
  const re = /(\^FDDADOS ADICIONAIS\^FS[\s\S]*?\^FB[^\n]*\^FH\^FD)([^\^]*)\^FS/i
  if (!re.test(zpl)) return zpl
  return zpl.replace(re, (_all, prefix: string, existing: string) => {
    const prev = String(existing || '').trim()
    const next = prev ? `${prev} · ${escaped}` : escaped
    return `${prefix}${next}^FS`
  })
}

function maxFieldOriginY (zpl: string): number {
  let maxY = 0
  for (const match of zpl.matchAll(/\^FO\d+,(\d+)/gi)) {
    const y = Number(match[1])
    if (Number.isFinite(y) && y > maxY) maxY = y
  }
  return maxY
}

function horizontalRuleYs (zpl: string): number[] {
  const lineYs: number[] = []
  for (const match of zpl.matchAll(/\^FO\d+,(\d+)\^GB\d+,0,\d+\^FS/gi)) {
    const y = Number(match[1])
    if (Number.isFinite(y)) lineYs.push(y)
  }
  return lineYs
}

/** Faixa estreita só em torno de RESIDENCIAL. */
export function findResidencialBand (zpl: string): { top: number, bottom: number } | null {
  const resMatch = zpl.match(/\^FO\d+,(\d+)[^\n]*\^FDRESIDENCIAL\^FS/i)
  if (!resMatch) return null
  const resY = Number(resMatch[1])
  if (!Number.isFinite(resY)) return null
  const lineYs = horizontalRuleYs(zpl)
  const above = lineYs.filter((y) => y < resY).sort((a, b) => b - a)[0]
  const below = lineYs.filter((y) => y > resY).sort((a, b) => a - b)[0]
  if (above == null || below == null || below <= above) return null
  return { top: above, bottom: below }
}

/**
 * Faixa vertical do miolo da etiqueta Flex:
 * linha abaixo de "Envio Flex" → linha acima de RESIDENCIAL.
 */
export function findSkuVerticalBand (zpl: string): { top: number, bottom: number } | null {
  const lineYs = horizontalRuleYs(zpl)
  const resMatch = zpl.match(/\^FO\d+,(\d+)[^\n]*\^FDRESIDENCIAL\^FS/i)
  const qrMatch = zpl.match(/\^FO\d+,(\d+)[^\n]*\^BQ/i)
  if (resMatch && qrMatch) {
    const resY = Number(resMatch[1])
    const qrY = Number(qrMatch[1])
    if (Number.isFinite(resY) && Number.isFinite(qrY)) {
      const top = lineYs.filter((y) => y < qrY).sort((a, b) => b - a)[0]
      // Linha imediatamente acima de RESIDENCIAL (fecha o miolo do QR/CEP).
      const bottom = lineYs.filter((y) => y < resY).sort((a, b) => b - a)[0]
      if (top != null && bottom != null && bottom > top) {
        return { top, bottom }
      }
    }
  }
  return findResidencialBand(zpl)
}

export function injectSkuOnLeft (zpl: string, skuText: string): string {
  const text = escapeZplText(skuText)
  if (!text) return zpl
  const first = firstLabelSlice(zpl)
  const printWidth = parseZplDimension(first, 'PW') ?? 812
  const labelLength = parseZplDimension(first, 'LL') ?? Math.max(1218, maxFieldOriginY(first) + 80)
  // ^A0B: texto sobe na margem esquerda. X fixo; Y (base) centra o bloco no miolo.
  const fontHeight = 32
  const fontWidth = 26
  // Labelary/fonte 0 avança bem menos que o width nominal; 0.5 alinha o centro visual.
  const charAdvance = Math.max(12, Math.round(fontWidth * 0.5))
  const x = Math.max(10, Math.round(printWidth * 0.015))
  const textLen = Math.max(1, text.length) * charAdvance
  const band = findSkuVerticalBand(first)

  let y: number
  if (band) {
    const bandCenter = (band.top + band.bottom) / 2
    // FO na base do texto ( ^A0B cresce para cima ). Centro do bloco = meio da faixa.
    y = Math.round(bandCenter + textLen / 2)
  } else {
    const qrAnchor = first.match(/\^FO(\d+),(\d+)[^\n]*\^BQ/i)
    const qrY = qrAnchor ? Number(qrAnchor[2]) : 275
    y = Math.min(
      Math.max(qrY + textLen + 40, Math.round(labelLength * 0.45)),
      Math.max(200, labelLength - 40),
    )
  }

  const snippet = `^FO${x},${y}^A0B,${fontHeight},${fontWidth}^FD${text}^FS`
  let next = insertBeforeFirstXz(zpl, snippet)
  next = fillDadosAdicionais(next, text)
  return next
}

export function injectNfFooter (zpl: string, nfText: string): string {
  const text = escapeZplText(nfText)
  if (!text) return zpl
  const filled = fillDadosAdicionais(zpl, text)
  if (filled !== zpl) return filled
  const first = firstLabelSlice(zpl)
  const printWidth = parseZplDimension(first, 'PW') ?? 812
  const labelLength = parseZplDimension(first, 'LL') ?? Math.max(1218, maxFieldOriginY(first) + 80)
  const fontHeight = 22
  const fontWidth = 18
  const x = Math.max(20, Math.round(printWidth * 0.06))
  const y = Math.max(40, labelLength - 48)
  const snippet = `^FO${x},${y}^A0N,${fontHeight},${fontWidth}^FD${text}^FS`
  return insertBeforeFirstXz(zpl, snippet)
}

export function extractZplFromShipmentLabelsZip (zipBytes: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(zipBytes)
  } catch {
    const asText = new TextDecoder('utf-8', { fatal: false }).decode(zipBytes)
    if (asText.includes('^XA') || asText.includes('^xz') || asText.includes('^XZ')) {
      return asText
    }
    throw new Error('meli_label_zip_invalid')
  }

  const entries = Object.entries(files)
  const preferred = entries.find(([name]) => /\.(txt|zpl)$/i.test(name))
  const fallback = entries.find(([, data]) => {
    const sample = new TextDecoder('utf-8', { fatal: false }).decode(data.slice(0, 200))
    return sample.includes('^XA') || sample.includes('^XZ')
  })
  const chosen = preferred ?? fallback
  if (!chosen) throw new Error('meli_label_zpl_missing')
  return new TextDecoder('utf-8', { fatal: false }).decode(chosen[1])
}

export function buildCustomizedShipmentLabelZpl (input: {
  zipBytes: Uint8Array
  items: SkuLabelItem[]
  isFlex: boolean
  nf?: {
    series?: string | number | null
    number?: string | number | null
    accessKey?: string | null
  } | null
}): string {
  let zpl = extractZplFromShipmentLabelsZip(input.zipBytes)
  const skuText = formatSkuLabelText(input.items)
  if (skuText) zpl = injectSkuOnLeft(zpl, skuText)
  if (!input.isFlex) {
    const nfText = formatNfFooterText(input.nf ?? {})
    if (nfText) zpl = injectNfFooter(zpl, nfText)
  }
  return zpl
}

/** Converte dots ZPL (8 dpmm) em polegadas arredondadas para a API Labelary. */
export function labelSizeInchesFromZpl (zpl: string): { width: number, height: number } {
  const dpmm = 8
  const printWidth = parseZplDimension(zpl, 'PW') ?? 812
  const labelLength = parseZplDimension(zpl, 'LL') ?? 1218
  const width = Math.min(8, Math.max(1, Math.round((printWidth / dpmm / 25.4) * 10) / 10))
  const height = Math.min(12, Math.max(1, Math.round((labelLength / dpmm / 25.4) * 10) / 10))
  return { width, height }
}

async function convertZplViaLabelary (
  zpl: string,
  accept: 'application/pdf' | 'image/png',
): Promise<Uint8Array> {
  const payload = String(zpl || '').trim()
  if (!payload) throw new Error('zpl_empty')
  const { width, height } = labelSizeInchesFromZpl(payload)
  const url = `https://api.labelary.com/v1/printers/8dpmm/labels/${width}x${height}/0/`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: accept,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: payload,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('[zpl-labelary]', accept, res.status, detail.slice(0, 300))
    throw new Error(accept === 'application/pdf' ? 'zpl_pdf_failed' : 'zpl_png_failed')
  }
  const buffer = await res.arrayBuffer()
  if (!buffer.byteLength) {
    throw new Error(accept === 'application/pdf' ? 'zpl_pdf_empty' : 'zpl_png_empty')
  }
  return new Uint8Array(buffer)
}

export async function convertZplToPdfBytes (zpl: string): Promise<Uint8Array> {
  return convertZplViaLabelary(zpl, 'application/pdf')
}

export async function convertZplToPngBytes (zpl: string): Promise<Uint8Array> {
  return convertZplViaLabelary(zpl, 'image/png')
}

export function uint8ToBase64 (bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
