import 'server-only'
import { NFeCore, type NFeProps, type SefazRequest, type SefazTransport, type TransmitResult } from '@brasil-fiscal/nfe'
import { getSefazUrl } from '@brasil-fiscal/nfe/dist/shared/constants/sefaz-urls'
import { loadA1CertificateMaterial } from '@/lib/fiscal/certificate'
import { isSefazCancelConfirmed } from '@/lib/fiscal/document-status'
import { createPemSefazTransport } from '@/lib/fiscal/sefaz-transport'
import { createNfceXmlBuilder } from '@/lib/fiscal/sefaz-xml'
import {
  buildNfceConsultaEnvelope,
  extractAccessKeyFromXml,
  extractNfeXmlFromSoap,
  NFCE_CONSULTA_SOAP_ACTION,
  parseNfceConsultaXml,
  type SefazConsultaParse,
} from '@/lib/fiscal/sefaz-consulta'

export type SefazClientConfig = {
  pfx: Buffer
  password: string
  environment: 'homologacao' | 'producao'
  uf: string
  cscId?: string | null
  csc?: string | null
  onSignedXml?: (input: { xml: string, accessKey: string | null }) => void | Promise<void>
}

export type SefazTransmitResult = {
  authorized: boolean
  protocol: string | null
  accessKey: string
  statusCode: string
  statusMessage: string
  authorizedXml: string | null
  authorizedAt: string | null
}

export type SefazCancelResult = {
  confirmed: boolean
  statusCode: string
  statusMessage: string
  protocol: string | null
}

type TransmitCapture = {
  accessKey: string | null
  signedXml: string | null
}

function sefazEventStatus (err: unknown) {
  if (!err || typeof err !== 'object') return null
  const record = err as { cStat?: unknown, xMotivo?: unknown, message?: unknown }
  const statusCode = record.cStat == null ? '' : String(record.cStat)
  if (!statusCode) return null
  return {
    statusCode,
    statusMessage: String(record.xMotivo || record.message || ''),
  }
}

function capturingTransport (
  inner: SefazTransport,
  capture: TransmitCapture,
  onSignedXml?: SefazClientConfig['onSignedXml'],
): SefazTransport {
  return {
    async send (req: SefazRequest) {
      const signedXml = extractNfeXmlFromSoap(req.xml)
      if (signedXml) {
        capture.signedXml = signedXml
        capture.accessKey = extractAccessKeyFromXml(signedXml) || capture.accessKey
        if (onSignedXml) {
          await onSignedXml({ xml: signedXml, accessKey: capture.accessKey })
        }
      }
      return inner.send(req)
    },
  }
}

function nfceConsultaUrl (uf: string, environment: 'homologacao' | 'producao') {
  try {
    return getSefazUrl(uf, environment, 'NFCeConsultaProtocolo')
  } catch {
    return getSefazUrl(uf, environment, 'NFeConsultaProtocolo')
  }
}

class ForgeA1CertificateProvider {
  constructor (
    private readonly pfx: Buffer,
    private readonly password: string,
  ) {}

  async load () {
    const material = loadA1CertificateMaterial(this.pfx, this.password)
    if (material.notAfter < new Date()) {
      throw new Error(`Certificado expirado em ${material.notAfter.toISOString()}`)
    }
    return {
      pfx: this.pfx,
      password: this.password,
      notAfter: material.notAfter,
      privateKey: material.privateKeyPem,
      certPem: material.certPem,
    }
  }
}

export function createSefazClient (config: SefazClientConfig) {
  const capture: TransmitCapture = { accessKey: null, signedXml: null }
  const transmitTransport = capturingTransport(
    createPemSefazTransport(config.pfx, config.password, 30000),
    capture,
    config.onSignedXml,
  )
  const consultTransport = createPemSefazTransport(config.pfx, config.password, 20000)
  const core = NFeCore.create({
    pfx: config.pfx,
    senha: config.password,
    ambiente: config.environment,
    uf: config.uf,
    cIdToken: config.cscId || undefined,
    csc: config.csc || undefined,
    certificate: new ForgeA1CertificateProvider(config.pfx, config.password),
    transport: transmitTransport,
    xmlBuilder: createNfceXmlBuilder(),
  })

  return {
    get lastAccessKey () {
      return capture.accessKey
    },
    get lastSignedXml () {
      return capture.signedXml
    },
    async transmitir (payload: NFeProps): Promise<SefazTransmitResult> {
      const result: TransmitResult = await core.transmitir(payload)
      return {
        authorized: Boolean(result.autorizada),
        protocol: result.protocolo ?? null,
        accessKey: result.chaveAcesso,
        statusCode: result.codigoStatus,
        statusMessage: result.motivo,
        authorizedXml: result.xmlProtocolado ?? null,
        authorizedAt: result.dataAutorizacao?.toISOString() ?? null,
      }
    },
    async consultar (accessKey: string): Promise<SefazConsultaParse> {
      const url = nfceConsultaUrl(config.uf, config.environment)
      const tpAmb = config.environment === 'producao' ? '1' : '2'
      const response = await consultTransport.send({
        url,
        soapAction: NFCE_CONSULTA_SOAP_ACTION,
        xml: buildNfceConsultaEnvelope(accessKey, tpAmb),
        pfx: config.pfx,
        password: config.password,
      })
      return parseNfceConsultaXml(response.xml)
    },
    async cancelar (input: {
      accessKey: string
      cnpj: string
      protocol: string
      justification: string
    }): Promise<SefazCancelResult> {
      try {
        const result = await core.cancelar({
          chaveAcesso: input.accessKey,
          cnpj: input.cnpj,
          protocolo: input.protocol,
          justificativa: input.justification,
        })
        return {
          confirmed: isSefazCancelConfirmed(result.cStat),
          statusCode: result.cStat,
          statusMessage: result.xMotivo,
          protocol: result.nProt ?? null,
        }
      } catch (err) {
        const status = sefazEventStatus(err)
        if (status) {
          return {
            confirmed: isSefazCancelConfirmed(status.statusCode),
            statusCode: status.statusCode,
            statusMessage: status.statusMessage,
            protocol: null,
          }
        }
        throw err
      }
    },
  }
}
