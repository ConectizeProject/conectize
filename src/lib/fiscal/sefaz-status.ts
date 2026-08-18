import 'server-only'
import https from 'https'
import forge from 'node-forge'
import { getSefazUrl } from '@brasil-fiscal/nfe/dist/shared/constants/sefaz-urls'

const UF_CODES: Record<string, string> = {
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

export type SefazStatusResult =
  | {
    ok: true
    available: boolean
    uf: string
    environment: 'homologacao' | 'producao'
    url: string
    statusCode: string | null
    statusMessage: string | null
    httpStatus: number
  }
  | { ok: false, error: string, message: string }

type SefazStatusCertificate = {
  pfxBuffer: Buffer
  password: string
}

function pfxToPemPair (certificate: SefazStatusCertificate) {
  const asn1 = forge.asn1.fromDer(certificate.pfxBuffer.toString('binary'))
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, certificate.password)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ]
  const cert = certBags
    .map((bag) => bag.cert)
    .find((item): item is forge.pki.Certificate => Boolean(item))
  const key = keyBags
    .map((bag) => bag.key)
    .find((item): item is forge.pki.rsa.PrivateKey => Boolean(item))

  if (!cert || !key) {
    throw new Error('pfx_missing_cert_or_key')
  }

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(key),
  }
}

function errorMessageFromUnknown (err: unknown) {
  const message = err instanceof Error ? err.message : String(err || '')
  const cause = err && typeof err === 'object' && 'cause' in err
    ? String((err as { cause?: unknown }).cause || '')
    : ''
  const details = `${message} ${cause}`.toLowerCase()

  if (details.includes('fetch failed') || details.includes('econnreset')) {
    return 'Não foi possível abrir conexão com a SEFAZ. Verifique internet, firewall, antivírus/proxy e tente novamente.'
  }
  if (details.includes('sefaz_status_timeout') || details.includes('timed') || details.includes('timeout') || details.includes('etimedout')) {
    return 'A SEFAZ demorou para responder. Tente novamente em alguns instantes.'
  }
  if (details.includes('certificate') || details.includes('tls') || details.includes('ssl')) {
    return 'Falha de TLS/SSL ao conectar com a SEFAZ. Verifique certificados raiz do ambiente, proxy e inspeção SSL.'
  }
  if (details.includes('enotfound') || details.includes('getaddrinfo')) {
    return 'Não foi possível resolver o endereço da SEFAZ. Verifique DNS e conexão com a internet.'
  }

  return message || 'Erro desconhecido ao comunicar com a SEFAZ.'
}

function extractTag (xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))
  return match?.[1]?.trim() || null
}

function statusSoap (ufCode: string, environment: 'homologacao' | 'producao') {
  const tpAmb = environment === 'producao' ? '1' : '2'
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${tpAmb}</tpAmb><cUF>${ufCode}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`
}

function postSoapWithCertificate (
  url: string,
  body: string,
  certificate: SefazStatusCertificate,
): Promise<{ httpStatus: number, xml: string }> {
  return new Promise((resolve, reject) => {
    const pem = pfxToPemPair(certificate)

    const request = https.request(url, {
      method: 'POST',
      cert: pem.certPem,
      key: pem.keyPem,
      rejectUnauthorized: true,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    }, (response) => {
      const chunks: Buffer[] = []

      response.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })

      response.on('end', () => {
        const xml = Buffer.concat(chunks).toString('utf8')
        resolve({
          httpStatus: response.statusCode || 0,
          xml,
        })
      })
    })

    request.on('timeout', () => {
      request.destroy(new Error('sefaz_status_timeout'))
    })
    request.on('error', reject)
    request.write(body)
    request.end()
  })
}

export async function testSefazStatus (
  ufRaw: string,
  environmentRaw: string,
  certificate?: SefazStatusCertificate,
): Promise<SefazStatusResult> {
  const uf = String(ufRaw || '').trim().toUpperCase()
  const environment = environmentRaw === 'producao' ? 'producao' : 'homologacao'
  const ufCode = UF_CODES[uf]
  if (!ufCode) {
    return { ok: false, error: 'invalid_uf', message: 'Informe uma UF válida no endereço fiscal. Use a sigla com 2 letras, como MG, SP ou RJ.' }
  }

  if (!certificate) {
    return {
      ok: false,
      error: 'missing_certificate',
      message: 'Cadastre o certificado digital A1 antes de testar a comunicação com a SEFAZ.',
    }
  }

  let url = ''
  try {
    url = getSefazUrl(uf, environment, 'NFeStatusServico')
  } catch {
    return {
      ok: false,
      error: 'sefaz_url_not_found',
      message: `Não encontrei endpoint de status para a SEFAZ ${uf} no ambiente ${environment}. Confira a UF e tente outro ambiente.`,
    }
  }

  try {
    const { httpStatus, xml } = await postSoapWithCertificate(url, statusSoap(ufCode, environment), certificate)
    const statusCode = extractTag(xml, 'cStat')
    const statusMessage = extractTag(xml, 'xMotivo')
    const available = httpStatus >= 200 && httpStatus < 300 && (statusCode === '107' || statusCode === '108' || statusCode === '109')

    return {
      ok: true,
      available,
      uf,
      environment,
      url,
      statusCode,
      statusMessage,
      httpStatus,
    }
  } catch (err) {
    return {
      ok: false,
      error: 'sefaz_unreachable',
      message: errorMessageFromUnknown(err),
    }
  }
}
