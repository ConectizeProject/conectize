/**
 * Parseia o texto exportado pelo 3utools (iDevice details).
 * Formato: linhas "Chave    Valor" (vários espaços ou tab entre chave e valor).
 */
import { resolveIphoneMarketingName } from '@/lib/resale/apple-iphone-identifiers'

export type Parsed3utools = {
  model?: string
  color?: string
  storage_gb?: string
  imei?: string
  imei2?: string
  serial?: string
  modelNumber?: string
  deviceClass?: string
  productType?: string
}

/** Linha de título costuma ter capacidade (64GB); linhas de chave têm vários espaços após o nome. */
function looksLikeTitleLine (line: string): boolean {
  if (!/\d+\s*[gG][bB]\b/.test(line)) return false
  if (/^[A-Za-z][A-Za-z0-9]*\s{2,}\S/.test(line)) return false
  return true
}

/** Variantes de modelo após o número (ordem: sequências mais longas primeiro no regex). */
const APPLE_DEVICE_MODEL_PREFIX =
  /^(iPhone|iPad)\s+(\d+(?:\s+(?:Pro\s+Max|Pro|Plus|mini|Max|Air|SE))*)\s+(.+)$/i

/** Cores compostas comuns no título do 3utools (mais longas primeiro). */
const MULTI_WORD_TITLE_COLORS = [
  'Pacific Blue',
  'Sierra Blue',
  'Alpine Green',
  'Midnight Green',
  'Space Gray',
  'Space Grey',
  'Space Black',
  'Blue Titanium',
  'Black Titanium',
  'White Titanium',
  'Natural Titanium',
  'Desert Titanium',
  'Rose Gold',
  'Product Red',
  'Deep Purple',
  'Graphite',
  'Starlight',
  'Ultramarine',
  'Titanium Gray',
  'Titanium Grey',
  'Cloud White',
  'Light Gold',
  'Sky Blue',
  'Mint Green',
  'Cosmic Orange',
].sort((a, b) => b.length - a.length)

function splitModelAndColorBeforeStorage (before: string): { model: string; color: string } {
  const appleMatch = before.match(APPLE_DEVICE_MODEL_PREFIX)
  if (appleMatch) {
    const model = `${appleMatch[1]} ${appleMatch[2]}`.replace(/\s+/g, ' ').trim()
    const color = appleMatch[3].trim()
    return { model, color }
  }

  const lower = before.toLowerCase()
  for (const colorName of MULTI_WORD_TITLE_COLORS) {
    const suffix = colorName.toLowerCase()
    if (!lower.endsWith(suffix)) continue
    const model = before.slice(0, before.length - colorName.length).trim()
    const color = before.slice(before.length - colorName.length).trim()
    if (model) return { model, color }
  }

  const parts = before.split(/\s+/)
  if (parts.length >= 2) {
    return {
      model: parts.slice(0, -1).join(' '),
      color: parts[parts.length - 1],
    }
  }

  return { model: before, color: '' }
}

/**
 * Aceita:
 * - "iPhone 15 Pro Max 256GB Blue Titanium" (GB antes da cor)
 * - "iPhone 12 Black 64GB" (GB no final)
 * - "iPhone 12 Pro Max Pacific Blue 128GB" (cor composta + GB no final)
 */
export function parseFirstLineFormat (line: string): { model: string; storage_gb: string; color: string } | null {
  const trimmed = line.trim()
  const storageMatch = trimmed.match(/\b(\d+)\s*[gG][bB]\b/)
  if (!storageMatch || storageMatch.index == null) return null

  const storage_gb = storageMatch[1]
  const before = trimmed.slice(0, storageMatch.index).trim()
  const after = trimmed.slice(storageMatch.index + storageMatch[0].length).trim()

  if (after) {
    return { model: before, storage_gb, color: after }
  }

  if (!before) return null

  const { model, color } = splitModelAndColorBeforeStorage(before)
  return { model, storage_gb, color }
}

function parseKeyValueLines (text: string): Record<string, string> {
  const map: Record<string, string> = {}
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match =
      trimmed.match(/^(.+?)\s{2,}(.+)$/) ||
      trimmed.match(/^([^\t]+)\t+(.+)$/) ||
      trimmed.match(/^(.+?):\s*(.+)$/)
    if (match) {
      map[match[1].trim()] = match[2].trim()
    }
  }
  return map
}

function parseTitleLine (lines: string[]): { model: string; storage_gb: string; color: string } | null {
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !looksLikeTitleLine(trimmed)) continue
    const parsed = parseFirstLineFormat(trimmed)
    if (parsed) return parsed
  }
  return null
}

export function parse3utoolsText (text: string): Parsed3utools {
  const lines = text.split(/\r?\n/)
  const map = parseKeyValueLines(text)
  const firstLineParsed = parseTitleLine(lines)

  const deviceClass = map.DeviceClass || ''
  const productTypeRaw = map.ProductType || ''
  const hardwareModel = map.HardwareModel || ''
  const modelFromIdentifier =
    resolveIphoneMarketingName(productTypeRaw, hardwareModel) ||
    (productTypeRaw.trim() || undefined)
  const colorFromFields = (map.DeviceColor || map.DeviceEnclosureColor || '').trim() || undefined
  const modelNumberRaw = map.ModelNumber || ''
  const regionInfo = map.RegionInfo || ''
  const modelNumber = [modelNumberRaw, regionInfo].filter(Boolean).join(' ').trim()

  const titleColor = firstLineParsed?.color?.trim() || undefined

  return {
    model: firstLineParsed?.model || modelFromIdentifier || deviceClass || undefined,
    color: titleColor || colorFromFields,
    storage_gb: firstLineParsed?.storage_gb,
    imei: map.InternationalMobileEquipmentIdentity || undefined,
    imei2: map.InternationalMobileEquipmentIdentity2 || undefined,
    serial: map.SerialNumber || undefined,
    modelNumber: modelNumber || undefined,
    deviceClass: deviceClass || undefined,
    productType: productTypeRaw || undefined,
  }
}
