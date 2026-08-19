import 'server-only'
import https from 'https'
import type { SefazRequest, SefazResponse, SefazTransport } from '@brasil-fiscal/nfe'
import { a1MaterialToMtls, loadA1CertificateMaterial } from '@/lib/fiscal/certificate'
import {
  decodeSefazHttpBody,
  isSefazSoapResponse,
  normalizeSefazSoapXml,
  sefazSoapFaultMessage,
} from '@/lib/fiscal/sefaz-soap'

/** mTLS com PEM: o Node 18+ recusa PFX A1 legado (RC2/3DES) em `pfx`. */
export class PemSefazTransport implements SefazTransport {
  constructor (
    private readonly certPem: string,
    private readonly keyPem: string,
    private readonly timeoutMs = 30000,
  ) {}

  send (req: SefazRequest): Promise<SefazResponse> {
    return new Promise((resolve, reject) => {
      const url = new URL(req.url)
      const cleanXml = req.xml
        .normalize('NFC')
        .replace(/\uFEFF/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x80-\x9F\uFFFE\uFFFF]/g, '')
      const utf8Buffer = Buffer.from(cleanXml, 'utf-8')

      const httpReq = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'Content-Type': `application/soap+xml; charset=UTF-8; action="${req.soapAction}"`,
          SOAPAction: req.soapAction,
          'Content-Length': utf8Buffer.byteLength,
          Accept: 'application/soap+xml, text/xml, */*',
          'Accept-Encoding': 'gzip, deflate',
        },
        cert: this.certPem,
        key: this.keyPem,
        rejectUnauthorized: false,
        timeout: this.timeoutMs,
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks)
            const xml = decodeSefazHttpBody(
              raw,
              res.headers['content-encoding'],
              res.headers['content-type'],
            )
            const statusCode = res.statusCode ?? 0
            const soapOk = isSefazSoapResponse(xml)
            if ((statusCode < 200 || statusCode >= 300) && !soapOk) {
              reject(new Error(`Erro HTTP ${statusCode} ao comunicar com SEFAZ: ${xml.slice(0, 500)}`))
              return
            }
            const fault = sefazSoapFaultMessage(xml)
            if (fault) {
              reject(new Error(`SOAP Fault da SEFAZ: ${fault}`))
              return
            }
            resolve({ xml: normalizeSefazSoapXml(xml), statusCode: statusCode || 200 })
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)))
          }
        })
        res.on('error', (err) => {
          reject(err)
        })
      })

      httpReq.on('timeout', () => {
        httpReq.destroy()
        reject(new Error('Timeout ao comunicar com SEFAZ'))
      })
      httpReq.on('error', (err) => {
        reject(err)
      })
      httpReq.write(utf8Buffer)
      httpReq.end()
    })
  }
}

export function createPemSefazTransport (pfx: Buffer, password: string, timeoutMs = 30000) {
  const mtls = a1MaterialToMtls(loadA1CertificateMaterial(pfx, password))
  return new PemSefazTransport(mtls.cert, mtls.key, timeoutMs)
}
