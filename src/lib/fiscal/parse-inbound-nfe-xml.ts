import { onlyDigits } from '@/lib/utils/strings'

export type ParsedInboundNfeItem = {
  lineNumber: number
  productCode: string | null
  barcode: string | null
  description: string
  ncm: string | null
  cest: string | null
  unit: string | null
  quantity: number
  unitValueCents: number
  totalCents: number
}

export type ParsedInboundNfe = {
  accessKey: string
  series: number
  number: number
  issuedAt: string | null
  issuerCnpj: string | null
  issuerName: string | null
  recipientCnpj: string | null
  recipientName: string | null
  totalCents: number
  items: ParsedInboundNfeItem[]
}

function firstTag (xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'i')
  const match = xml.match(re)
  if (!match) return null
  return String(match[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || null
}

function allBlocks (xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'gi')
  const blocks: string[] = []
  let match = re.exec(xml)
  while (match) {
    blocks.push(String(match[1] || ''))
    match = re.exec(xml)
  }
  return blocks
}

function moneyToCents (raw: string | null): number {
  if (!raw) return 0
  const normalized = String(raw).trim().replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return 0
  return Math.round(value * 100)
}

function quantityValue (raw: string | null): number {
  if (!raw) return 0
  const normalized = String(raw).trim().replace(',', '.')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return 0
  return value
}

function normalizeBarcode (raw: string | null): string | null {
  const digits = onlyDigits(raw || '')
  if (!digits || /^0+$/.test(digits)) return null
  return digits
}

function extractAccessKey (xml: string): string | null {
  const infMatch = xml.match(/\bId\s*=\s*["']NFe(\d{44})["']/i)
  if (infMatch?.[1]) return infMatch[1]
  const chNFe = onlyDigits(firstTag(xml, 'chNFe') || '')
  if (chNFe.length === 44) return chNFe
  return null
}

function looksLikeNfeXml (xml: string) {
  return /<(?:[\w.-]+:)?NFe\b/i.test(xml) || /<(?:[\w.-]+:)?nfeProc\b/i.test(xml)
}

function unescapeXmlDocument (xml: string) {
  if (looksLikeNfeXml(xml)) return xml
  if (!xml.includes('&lt;')) return xml
  const decoded = xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
  return looksLikeNfeXml(decoded) ? decoded : xml
}

export function readInboundXmlUpload (bytes: Uint8Array):
  | { ok: true, xml: string }
  | { ok: false, error: string, message: string } {
  if (
    bytes.length >= 4
    && bytes[0] === 0x50
    && bytes[1] === 0x4b
    && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
    && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  ) {
    return {
      ok: false,
      error: 'zip_xml',
      message: 'O arquivo é um ZIP. Extraia o XML da NF-e e envie o arquivo .xml.',
    }
  }

  let xml = ''
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    xml = new TextDecoder('utf-16le').decode(bytes)
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    xml = new TextDecoder('utf-16be').decode(bytes)
  } else {
    xml = new TextDecoder('utf-8').decode(bytes)
  }

  xml = unescapeXmlDocument(xml.replace(/^\uFEFF/, '').trim())
  if (!xml) {
    return { ok: false, error: 'empty_xml', message: 'Arquivo XML vazio.' }
  }
  return { ok: true, xml }
}

function parseIssuedAt (raw: string | null): string | null {
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

/**
 * Extrai dados essenciais de um XML de NF-e (nfeProc ou NFe).
 * Aceita namespaces e CDATA sem dependência externa.
 */
export function parseInboundNfeXml (xmlRaw: string):
  | { ok: true, document: ParsedInboundNfe }
  | { ok: false, error: string, message: string } {
  const xml = unescapeXmlDocument(String(xmlRaw || '').replace(/^\uFEFF/, '').trim())
  if (!xml) {
    return { ok: false, error: 'empty_xml', message: 'Arquivo XML vazio.' }
  }
  if (!looksLikeNfeXml(xml)) {
    return { ok: false, error: 'invalid_xml', message: 'O arquivo não parece ser uma NF-e válida. Envie o XML da nota (nfeProc), não o DANFE nem um ZIP.' }
  }

  const accessKey = extractAccessKey(xml)
  if (!accessKey) {
    return { ok: false, error: 'missing_access_key', message: 'Não foi possível ler a chave de acesso da NF-e.' }
  }

  const ide = firstTag(xml, 'ide') || xml
  const emit = firstTag(xml, 'emit') || ''
  const dest = firstTag(xml, 'dest') || ''
  const total = firstTag(xml, 'total') || ''
  const series = Number(onlyDigits(firstTag(ide, 'serie') || '') || 0)
  const number = Number(onlyDigits(firstTag(ide, 'nNF') || '') || 0)
  if (!series || !number) {
    return { ok: false, error: 'missing_number', message: 'Série ou número da NF-e não encontrados.' }
  }

  const detBlocks = allBlocks(xml, 'det')
  if (detBlocks.length === 0) {
    return { ok: false, error: 'missing_items', message: 'A NF-e não possui itens.' }
  }

  const items: ParsedInboundNfeItem[] = []
  for (let index = 0; index < detBlocks.length; index += 1) {
    const det = detBlocks[index]
    const prod = firstTag(det, 'prod') || det
    const description = firstTag(prod, 'xProd') || `Item ${index + 1}`
    const quantity = quantityValue(firstTag(prod, 'qCom'))
    if (quantity <= 0) {
      return {
        ok: false,
        error: 'invalid_item_quantity',
        message: `Quantidade inválida no item "${description}".`,
      }
    }
    const unitValueCents = moneyToCents(firstTag(prod, 'vUnCom'))
    const totalCents = moneyToCents(firstTag(prod, 'vProd')) || Math.round(unitValueCents * quantity)
    items.push({
      lineNumber: index + 1,
      productCode: firstTag(prod, 'cProd'),
      barcode: normalizeBarcode(firstTag(prod, 'cEAN')) || normalizeBarcode(firstTag(prod, 'cEANTrib')),
      description,
      ncm: onlyDigits(firstTag(prod, 'NCM') || '') || null,
      cest: onlyDigits(firstTag(prod, 'CEST') || '') || null,
      unit: (firstTag(prod, 'uCom') || 'UN').toUpperCase().slice(0, 6),
      quantity,
      unitValueCents,
      totalCents,
    })
  }

  const icmsTot = firstTag(total, 'ICMSTot') || total
  const totalCents = moneyToCents(firstTag(icmsTot, 'vNF'))
    || items.reduce((sum, item) => sum + item.totalCents, 0)

  return {
    ok: true,
    document: {
      accessKey,
      series,
      number,
      issuedAt: parseIssuedAt(firstTag(ide, 'dhEmi') || firstTag(ide, 'dEmi')),
      issuerCnpj: onlyDigits(firstTag(emit, 'CNPJ') || firstTag(emit, 'CPF') || '') || null,
      issuerName: firstTag(emit, 'xNome'),
      recipientCnpj: onlyDigits(firstTag(dest, 'CNPJ') || firstTag(dest, 'CPF') || '') || null,
      recipientName: firstTag(dest, 'xNome'),
      totalCents,
      items,
    },
  }
}
