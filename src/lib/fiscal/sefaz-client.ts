import 'server-only'
import { NFeCore, type NFeProps, type TransmitResult } from '@brasil-fiscal/nfe'

export type SefazClientConfig = {
  pfx: Buffer
  password: string
  environment: 'homologacao' | 'producao'
  uf: string
  cscId?: string | null
  csc?: string | null
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

export function createSefazClient (config: SefazClientConfig) {
  const core = NFeCore.create({
    pfx: config.pfx,
    senha: config.password,
    ambiente: config.environment,
    uf: config.uf,
    cIdToken: config.cscId || undefined,
    csc: config.csc || undefined,
  })

  return {
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
    async cancelar (input: {
      accessKey: string
      cnpj: string
      protocol: string
      justification: string
    }) {
      return core.cancelar({
        chaveAcesso: input.accessKey,
        cnpj: input.cnpj,
        protocolo: input.protocol,
        justificativa: input.justification,
      })
    },
  }
}
