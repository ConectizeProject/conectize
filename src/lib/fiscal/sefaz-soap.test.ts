import { describe, expect, it } from 'vitest'
import zlib from 'zlib'
import {
  decodeSefazHttpBody,
  normalizeSefazSoapXml,
  sefazSoapFaultMessage,
} from '@/lib/fiscal/sefaz-soap'

describe('normalizeSefazSoapXml', () => {
  it('keeps soap:Body envelopes', () => {
    const xml = '<soap:Envelope><soap:Body><retEnviNFe/></soap:Body></soap:Envelope>'
    expect(normalizeSefazSoapXml(xml)).toBe(xml)
  })

  it('rewrites WCF s:Body to soap:Body', () => {
    const xml = '<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"><s:Body><nfeResultMsg><retEnviNFe><cStat>100</cStat></retEnviNFe></nfeResultMsg></s:Body></s:Envelope>'
    const normalized = normalizeSefazSoapXml(xml)
    expect(normalized).toContain('<soap:Body>')
    expect(normalized).toContain('<cStat>100</cStat>')
    expect(normalized).not.toContain('s:Body')
  })

  it('rewrites SOAP-ENV:Body', () => {
    const xml = '<SOAP-ENV:Envelope><SOAP-ENV:Body><retEnviNFe/></SOAP-ENV:Body></SOAP-ENV:Envelope>'
    expect(normalizeSefazSoapXml(xml)).toContain('<soap:Body><retEnviNFe/></soap:Body>')
  })

  it('wraps payload without envelope', () => {
    const xml = '<retEnviNFe><cStat>104</cStat></retEnviNFe>'
    expect(normalizeSefazSoapXml(xml)).toContain('<soap:Body><retEnviNFe><cStat>104</cStat></retEnviNFe></soap:Body>')
  })

  it('rejects HTML', () => {
    expect(() => normalizeSefazSoapXml('<html><body>erro</body></html>')).toThrow(/HTML/)
  })
})

describe('decodeSefazHttpBody', () => {
  it('gunzips SEFAZ payloads', () => {
    const xml = '<s:Envelope><s:Body><retEnviNFe/></s:Body></s:Envelope>'
    const gz = zlib.gzipSync(Buffer.from(xml, 'utf8'))
    expect(decodeSefazHttpBody(gz, 'gzip')).toBe(xml)
  })
})

describe('sefazSoapFaultMessage', () => {
  it('reads SOAP 1.2 fault text', () => {
    const xml = '<s:Envelope><s:Body><s:Fault><s:Reason><s:Text>Schema invalid</s:Text></s:Reason></s:Fault></s:Body></s:Envelope>'
    expect(sefazSoapFaultMessage(xml)).toBe('Schema invalid')
  })
})
