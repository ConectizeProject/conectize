/**
 * Parseia o texto exportado pelo 3utools (iDevice details).
 * Formato: linhas "Chave    Valor" (vários espaços ou tab entre chave e valor).
 */
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

/**
 * Formato padrão da primeira linha: "Modelo XXXGB Cor" (ex: iPhone 15 Pro Max 256GB Blue Titanium).
 * Retorna { model, storage_gb, color } ou null se não bater.
 */
function parseFirstLineFormat(line: string): { model: string; storage_gb: string; color: string } | null {
  const trimmed = line.trim()
  const match = trimmed.match(/^(.+)\s+(\d+)\s*[gG][bB]\s+(.+)$/)
  if (!match) return null
  return {
    model: match[1].trim(),
    storage_gb: match[2].trim(),
    color: match[3].trim(),
  }
}

/**
 * Limpa o ProductType do 3utools (ex: "iPhone14,5" -> "iPhone 14").
 * Troca vírgula por ponto, insere espaço entre nome e número e remove o sufixo decimal (.5, .1, etc).
 */
function cleanProductType(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  const withDot = trimmed.replace(/,/g, '.')
  const withSpace = withDot.replace(/([a-zA-Z]+)(\d)/g, '$1 $2').trim()
  return withSpace.replace(/\.\d+$/, '').trim()
}

const DEVICE_COLOR_MAP: Record<string, string> = {
  '0': 'Desconhecido',
  '1': 'Preto',
  '2': 'Branco',
  '3': 'Dourado',
  '4': 'Rosa dourado',
  '5': 'Prata',
  '6': 'Space Gray',
  '7': 'Rosa',
  '8': 'Azul',
  '9': 'Amarelo',
  '10': 'Verde',
  '11': 'Vermelho',
  '12': 'Roxo',
  '13': 'Azul meia-noite',
  '14': 'Estelar',
  '15': 'Verde alpino',
  '16': 'Rosa',
  '17': 'Preto',
}

export function parse3utoolsText(text: string): Parsed3utools {
  const map: Record<string, string> = {}
  const lines = text.split(/\r?\n/)

  const firstLineParsed = (() => {
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const parsed = parseFirstLineFormat(trimmed)
      if (parsed) return parsed
      break
    }
    return null
  })()

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(.+?)\s{2,}(.+)$/) || trimmed.match(/^([^\t]+)\t+(.+)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()
      map[key] = value
    }
  }

  const deviceClass = map['DeviceClass'] || ''
  const productTypeRaw = map['ProductType'] || ''
  const productType = productTypeRaw ? cleanProductType(productTypeRaw) : ''
  const modelFromProductType = productType || deviceClass || undefined

  const colorCode = map['DeviceColor'] || map['DeviceEnclosureColor'] || ''
  const colorFromMap = DEVICE_COLOR_MAP[colorCode] || (colorCode ? colorCode : undefined)

  return {
    model: firstLineParsed ? firstLineParsed.model : modelFromProductType,
    color: firstLineParsed ? firstLineParsed.color : colorFromMap,
    storage_gb: firstLineParsed ? firstLineParsed.storage_gb : undefined,
    imei: map['InternationalMobileEquipmentIdentity'] || undefined,
    imei2: map['InternationalMobileEquipmentIdentity2'] || undefined,
    serial: map['SerialNumber'] || undefined,
    modelNumber: map['ModelNumber'] || undefined,
    deviceClass: deviceClass || undefined,
    productType: productTypeRaw ? productType : undefined,
  }
}
