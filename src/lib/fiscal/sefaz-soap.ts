import zlib from 'zlib'

const KNOWN_SOAP_BODY_RE = /<(?:soap12|soapenv|soap):Body\b/i
const PREFIXED_BODY_RE = /<([A-Za-z_][\w.\-]*):Body\b[^>]*>([\s\S]*?)<\/\1:Body>/
const UNPREFIXED_BODY_RE = /<Body\b[^>]*>([\s\S]*?)<\/Body>/
const PAYLOAD_RE = /<(?:retEnviNFe|nfeResultMsg|nfeAutorizacaoLoteResult|nfeResultadoMsg|retConsSitNFe|retConsStatServ|retEvento|procEventoNFe)\b/i

function snippet (xml: string) {
  return xml.replace(/\s+/g, ' ').trim().slice(0, 280)
}

function wrapSoapBody (inner: string) {
  return `<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body>${inner.trim()}</soap:Body></soap:Envelope>`
}

export function decodeSefazHttpBody (
  buffer: Buffer,
  contentEncoding?: string | string[],
  contentType?: string | string[],
) {
  const encoding = String(Array.isArray(contentEncoding) ? contentEncoding.join(',') : contentEncoding || '').toLowerCase()
  let data = buffer
  const isGzipMagic = data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b

  try {
    if (encoding.includes('gzip') || isGzipMagic) {
      data = zlib.gunzipSync(data)
    } else if (encoding.includes('deflate')) {
      data = zlib.inflateSync(data)
    } else if (encoding.includes('br')) {
      data = zlib.brotliDecompressSync(data)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Falha ao descomprimir resposta da SEFAZ: ${message}`)
  }

  const type = String(Array.isArray(contentType) ? contentType.join(';') : contentType || '')
  if (/utf-16|unicode/i.test(type) || (data[0] === 0xff && data[1] === 0xfe)) {
    return data.toString('utf16le').replace(/^\uFEFF/, '')
  }
  return data.toString('utf8').replace(/^\uFEFF/, '')
}

export function sefazSoapFaultMessage (xml: string) {
  if (!/<(?:[\w.\-]+:)?Fault\b/i.test(xml)) return null
  const text = xml.match(/<(?:[\w.\-]+:)?Text\b[^>]*>([\s\S]*?)<\/(?:[\w.\-]+:)?Text>/i)
    || xml.match(/<(?:[\w.\-]+:)?faultstring\b[^>]*>([\s\S]*?)<\/(?:[\w.\-]+:)?faultstring>/i)
  if (!text?.[1]) return null
  const reason = text[1].replace(/<[^>]+>/g, '').trim()
  return reason || null
}

/** A lib só lê soap/soap12/soapenv:Body. SEFAZ/WCF responde s:Body, SOAP-ENV, etc. */
export function normalizeSefazSoapXml (xml: string) {
  const text = String(xml || '').trim()
  if (!text) {
    throw new Error('A SEFAZ retornou uma resposta vazia.')
  }
  if (/<html[\s>]/i.test(text)) {
    throw new Error(`A SEFAZ retornou HTML em vez de SOAP. Trecho: ${snippet(text)}`)
  }
  if (KNOWN_SOAP_BODY_RE.test(text)) return text

  const prefixed = text.match(PREFIXED_BODY_RE)
  if (prefixed?.[2] != null) return wrapSoapBody(prefixed[2])

  const unprefixed = text.match(UNPREFIXED_BODY_RE)
  if (unprefixed?.[1] != null) return wrapSoapBody(unprefixed[1])

  if (PAYLOAD_RE.test(text)) return wrapSoapBody(text)

  throw new Error(`Resposta SOAP inválida da SEFAZ. Trecho: ${snippet(text)}`)
}

export function isSefazSoapResponse (xml: string) {
  return KNOWN_SOAP_BODY_RE.test(xml)
    || PREFIXED_BODY_RE.test(xml)
    || UNPREFIXED_BODY_RE.test(xml)
    || PAYLOAD_RE.test(xml)
}
