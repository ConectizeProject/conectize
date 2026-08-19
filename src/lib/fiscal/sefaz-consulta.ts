export type SefazConsultaKind = 'authorized' | 'canceled' | 'denied' | 'not_found' | 'other'

export type SefazConsultaParse = {
  kind: SefazConsultaKind
  statusCode: string
  statusMessage: string
  protocol: string | null
  authorizedAt: string | null
  protNfeXml: string | null
}

const CONSULTA_SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4/nfeConsultaNF'
const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe'
const WSDL_CONSULTA = `${NFE_NAMESPACE}/wsdl/NFeConsultaProtocolo4`

export const NFCE_CONSULTA_SOAP_ACTION = CONSULTA_SOAP_ACTION

function extractTag (xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'i'))
  return match?.[1]?.trim() || null
}

export function extractAccessKeyFromXml (xml: string) {
  const infNfe = xml.match(/Id="NFe(\d{44})"/i)
  if (infNfe?.[1]) return infNfe[1]
  const chNfe = xml.match(/<(?:[\w.-]+:)?chNFe>(\d{44})<\/(?:[\w.-]+:)?chNFe>/i)
  return chNfe?.[1] || null
}

export function extractNfeXmlFromSoap (xml: string) {
  const match = xml.match(/<(?:[\w.-]+:)?NFe\b[\s\S]*?<\/(?:[\w.-]+:)?NFe>/)
  return match?.[0] || null
}

/** Aceita o XML assinado da NFC-e; ignora o JSON antigo de controle. */
export function asSignedNfceXml (value: unknown) {
  const text = String(value ?? '').trim()
  if (!text || text.startsWith('{') || text.startsWith('[')) return null
  return extractNfeXmlFromSoap(text) || (/<(?:[\w.-]+:)?NFe\b/i.test(text) ? text : null)
}

export function extractNfeProcXml (xml: string) {
  const match = xml.match(/<(?:[\w.-]+:)?nfeProc\b[\s\S]*?<\/(?:[\w.-]+:)?nfeProc>/i)
  return match?.[0] || null
}

export function withXmlDeclaration (xml: string) {
  const trimmed = String(xml || '').trim()
  if (!trimmed) return ''
  if (/^<\?xml\b/i.test(trimmed)) return trimmed
  return `<?xml version="1.0" encoding="UTF-8"?>${trimmed}`
}

/** Prefere o XML protocolado (nfeProc); aceita o <NFe> assinado se o protocolo não estiver gravado. */
export function asDownloadableNfceXml (value: unknown) {
  const text = String(value ?? '').trim()
  if (!text || text.startsWith('{') || text.startsWith('[')) return null
  const proc = extractNfeProcXml(text)
  if (proc) return withXmlDeclaration(proc)
  const nfe = asSignedNfceXml(text)
  return nfe ? withXmlDeclaration(nfe) : null
}

export function nfceXmlFilename (accessKey: string | null | undefined, series?: number, number?: number) {
  const key = String(accessKey || '').replace(/\D/g, '')
  if (key.length === 44) return `${key}.xml`
  const serie = Number(series) || 0
  const n = Number(number) || 0
  if (serie > 0 && n > 0) return `NFCe-${serie}-${String(n).padStart(9, '0')}.xml`
  return 'nfce.xml'
}

export function extractQrCodeUrlFromXml (xml: string) {
  if (!xml) return null
  const cdata = xml.match(/<(?:[\w.-]+:)?qrCode>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/(?:[\w.-]+:)?qrCode>/i)
  if (cdata?.[1]) return cdata[1].trim()
  const plain = xml.match(/<(?:[\w.-]+:)?qrCode>([\s\S]*?)<\/(?:[\w.-]+:)?qrCode>/i)
  if (!plain?.[1]) return null
  return plain[1]
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export function buildNfeProcXml (signedNfe: string, protNfeXml: string) {
  const nfeContent = signedNfe.replace(/<\?xml[^?]*\?>\s*/g, '').trim()
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<nfeProc versao="4.00" xmlns="${NFE_NAMESPACE}">` +
    nfeContent +
    protNfeXml +
    '</nfeProc>'
  )
}

export function buildNfceConsultaEnvelope (accessKey: string, tpAmb: '1' | '2') {
  return [
    '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">',
    '<soap:Body>',
    `<nfeDadosMsg xmlns="${WSDL_CONSULTA}">`,
    `<consSitNFe versao="4.00" xmlns="${NFE_NAMESPACE}">`,
    `<tpAmb>${tpAmb}</tpAmb>`,
    '<xServ>CONSULTAR</xServ>',
    `<chNFe>${accessKey}</chNFe>`,
    '</consSitNFe>',
    '</nfeDadosMsg>',
    '</soap:Body>',
    '</soap:Envelope>',
  ].join('')
}

export function classifyConsultaStatus (statusCode: string): SefazConsultaKind {
  const code = String(statusCode || '').trim()
  if (code === '100') return 'authorized'
  if (code === '101' || code === '151' || code === '155') return 'canceled'
  if (code === '110' || code === '301' || code === '302') return 'denied'
  if (code === '217') return 'not_found'
  return 'other'
}

export function parseNfceConsultaXml (xml: string): SefazConsultaParse {
  const ret = xml.match(/<(?:[\w.-]+:)?retConsSitNFe\b[\s\S]*?<\/(?:[\w.-]+:)?retConsSitNFe>/i)?.[0] || xml
  const protNfeXml = ret.match(/<(?:[\w.-]+:)?protNFe\b[\s\S]*?<\/(?:[\w.-]+:)?protNFe>/i)?.[0] || null
  const situationXml = protNfeXml ? ret.slice(0, ret.indexOf(protNfeXml)) : ret
  const statusCode = extractTag(situationXml, 'cStat') || extractTag(ret, 'cStat') || ''
  const protocolSource = protNfeXml || ret
  const receivedAt = extractTag(protocolSource, 'dhRecbto')

  return {
    kind: classifyConsultaStatus(statusCode),
    statusCode,
    statusMessage: extractTag(situationXml, 'xMotivo') || extractTag(ret, 'xMotivo') || 'Consulta sem mensagem da SEFAZ.',
    protocol: extractTag(protocolSource, 'nProt'),
    authorizedAt: receivedAt ? new Date(receivedAt).toISOString() : null,
    protNfeXml,
  }
}

export function isUncertainSefazError (err: unknown) {
  const message = err instanceof Error ? err.message : String(err || '')
  const cause = err && typeof err === 'object' && 'cause' in err
    ? String((err as { cause?: unknown }).cause || '')
    : ''
  const details = `${message} ${cause}`.toLowerCase()
  return (
    details.includes('timeout') ||
    details.includes('etimedout') ||
    details.includes('econnreset') ||
    details.includes('econnrefused') ||
    details.includes('enotfound') ||
    details.includes('eai_again') ||
    details.includes('socket hang up') ||
    details.includes('fetch failed') ||
    details.includes('network') ||
    details.includes('epipe')
  )
}

export function isDuplicateSefazError (err: unknown) {
  if (!err || typeof err !== 'object') return false
  return String((err as { cStat?: unknown }).cStat || '') === '204'
}
