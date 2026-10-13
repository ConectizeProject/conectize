const MODEL_BY_SKU_CODE: Record<string, string> = {
  '6G': '6',
  '6S': '6s',
  '6P': '6 Plus',
  '7G': '7',
  '8G': '8',
  '8P': '8 Plus',
  SE1: 'SE',
  SE2: 'SE (2020)',
  SE3: 'SE (2022)',
  X: 'X',
  XS: 'XS',
  XSM: 'XS Max',
  XR: 'XR',
  '11': '11',
  '11P': '11 Pro',
  '11PM': '11 Pro Max',
  '12M': '12 Mini',
  '12E12P': '12 e 12 Pro',
  '12PM': '12 Pro Max',
  '13': '13',
  '13M': '13 Mini',
  '13P': '13 Pro',
  '13PM': '13 Pro Max',
  '14': '14',
  '14PLUS': '14 Plus',
  '14P': '14 Pro',
  '14PM': '14 Pro Max',
  '15': '15',
  '15PLUS': '15 Plus',
  '15P': '15 Pro',
  '15PM': '15 Pro Max',
  '16': '16',
  '16E': '16e',
  '16PLUS': '16 Plus',
  '16P': '16 Pro',
  '16PM': '16 Pro Max',
  '17': '17',
  '17E': '17e',
  '17AIR': '17 Air',
  '17P': '17 Pro',
  '17PM': '17 Pro Max',
}

const SKU_PREFIX = 'BATERIAIP'

export function iphoneBatteryVariationModel (sku: string | null | undefined): string | null {
  const raw = String(sku || '').trim().toUpperCase()
  if (!raw.startsWith(SKU_PREFIX) || raw.length <= SKU_PREFIX.length) return null
  return MODEL_BY_SKU_CODE[raw.slice(SKU_PREFIX.length)] ?? null
}

export function iphoneBatteryListVariationName (
  name: string,
  parentName: string | null | undefined,
  sku: string | null | undefined,
): string {
  const current = String(name || '').trim()
  const parent = String(parentName || '').trim()
  if (!parent || current.toLowerCase() !== parent.toLowerCase()) return current
  const model = iphoneBatteryVariationModel(sku)
  if (!model) return current
  return `${parent} Modelo:${model}`
}
