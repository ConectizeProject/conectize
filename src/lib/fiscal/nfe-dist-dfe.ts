import { gunzipSync } from 'zlib'

export const NFE_UF_IBGE: Record<string, string> = {
  AC: '12',
  AL: '27',
  AP: '16',
  AM: '13',
  BA: '29',
  CE: '23',
  DF: '53',
  ES: '32',
  GO: '52',
  MA: '21',
  MT: '51',
  MS: '50',
  MG: '31',
  PA: '15',
  PB: '25',
  PR: '41',
  PE: '26',
  PI: '22',
  RJ: '33',
  RN: '24',
  RS: '43',
  RO: '11',
  RR: '14',
  SC: '42',
  SP: '35',
  SE: '28',
  TO: '17',
}

export const NFE_DIST_DFE_URL = {
  producao: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
} as const

export const NFE_DIST_DFE_SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse'

const NFE_NAMESPACE = 'http://www.portalfiscal.inf.br/nfe'
const DIST_WSDL = `${NFE_NAMESPACE}/wsdl/NFeDistribuicaoDFe`

export type NfeDistDFeParse =
  | { ok: true, xml: string }
  | {
    ok: false
    error: 'not_found' | 'rate_limited' | 'summary_only' | 'empty_document' | 'sefaz_rejected'
    statusCode: string
    message: string
  }

function firstTag (xml: string, tag: string) {
  const match = xml.match(new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${tag}>`, 'i'))
  return match?.[1]?.trim() || ''
}

function distDfeUserMessage (statusCode: string, statusMessage: string) {
  if (statusCode === '137') {
    return 'A SEFAZ não encontrou o XML desta nota para o CNPJ da loja. Confira se a nota é destinada a esta empresa ou envie o arquivo XML.'
  }
  if (statusCode === '656') {
    return 'A SEFAZ limitou as consultas por excesso de uso. Aguarde alguns minutos e tente de novo.'
  }
  return statusMessage || 'A SEFAZ não devolveu o XML da nota.'
}

export function buildNfeDistDFeEnvelope (input: {
  environment: 'homologacao' | 'producao'
  ufCode: string
  cnpj: string
  accessKey: string
}) {
  const tpAmb = input.environment === 'producao' ? '1' : '2'
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">',
    '<soap12:Body>',
    `<nfeDistDFeInteresse xmlns="${DIST_WSDL}">`,
    '<nfeDadosMsg>',
    `<distDFeInt versao="1.01" xmlns="${NFE_NAMESPACE}">`,
    `<tpAmb>${tpAmb}</tpAmb>`,
    `<cUFAutor>${input.ufCode}</cUFAutor>`,
    `<CNPJ>${input.cnpj}</CNPJ>`,
    '<consChNFe>',
    `<chNFe>${input.accessKey}</chNFe>`,
    '</consChNFe>',
    '</distDFeInt>',
    '</nfeDadosMsg>',
    '</nfeDistDFeInteresse>',
    '</soap12:Body>',
    '</soap12:Envelope>',
  ].join('')
}

function decodeDocZipPayload (payload: string) {
  const raw = Buffer.from(payload, 'base64')
  try {
    return gunzipSync(raw).toString('utf8')
  } catch {
    return raw.toString('utf8')
  }
}

function isFullNfeXml (xml: string, schema: string) {
  if (/resNFe|resEvento|procEvento/i.test(schema)) return false
  if (/procNFe|nfeProc/i.test(schema)) return true
  return /<(?:[\w.-]+:)?nfeProc\b/i.test(xml) || /<(?:[\w.-]+:)?NFe\b/i.test(xml)
}

function docZipEntries (xml: string) {
  const re = /<(?:[\w.-]+:)?docZip\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?docZip>/gi
  const entries: Array<{ schema: string, xml: string }> = []
  let match = re.exec(xml)
  while (match) {
    const attrs = match[1] || ''
    const schema = attrs.match(/\bschema\s*=\s*["']([^"']+)["']/i)?.[1] || ''
    const payload = String(match[2] || '').replace(/\s/g, '')
    if (payload) {
      entries.push({ schema, xml: decodeDocZipPayload(payload) })
    }
    match = re.exec(xml)
  }
  return entries
}

export function parseNfeDistDFeResponse (soapXml: string): NfeDistDFeParse {
  const ret = soapXml.match(/<(?:[\w.-]+:)?retDistDFeInt\b[\s\S]*?<\/(?:[\w.-]+:)?retDistDFeInt>/i)?.[0] || soapXml
  const statusCode = firstTag(ret, 'cStat')
  const statusMessage = firstTag(ret, 'xMotivo')
  const documents = docZipEntries(ret)
  const full = documents.find((entry) => isFullNfeXml(entry.xml, entry.schema))
  if (full?.xml) return { ok: true, xml: full.xml }
  if (documents.length > 0) {
    return {
      ok: false,
      error: 'summary_only',
      statusCode: statusCode || '138',
      message: 'A SEFAZ devolveu só o resumo da nota, sem os produtos. Envie o XML do fornecedor ou manifeste a nota no portal da SEFAZ.',
    }
  }
  if (statusCode === '137') {
    return {
      ok: false,
      error: 'not_found',
      statusCode,
      message: distDfeUserMessage(statusCode, statusMessage),
    }
  }
  if (statusCode === '656') {
    return {
      ok: false,
      error: 'rate_limited',
      statusCode,
      message: distDfeUserMessage(statusCode, statusMessage),
    }
  }
  if (!statusCode) {
    return {
      ok: false,
      error: 'empty_document',
      statusCode: '',
      message: 'A SEFAZ não devolveu o XML da nota.',
    }
  }
  return {
    ok: false,
    error: 'sefaz_rejected',
    statusCode,
    message: distDfeUserMessage(statusCode, statusMessage),
  }
}
