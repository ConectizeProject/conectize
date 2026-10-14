import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { isFiscalCertificateExpired, fiscalCertificateExpiredMessage } from '@/lib/fiscal/certificate-validity'
import { getFiscalCertificateSecret } from '@/lib/fiscal/profile'
import {
  buildNfeDistDFeEnvelope,
  NFE_DIST_DFE_SOAP_ACTION,
  NFE_DIST_DFE_URL,
  NFE_UF_IBGE,
  parseNfeDistDFeResponse,
} from '@/lib/fiscal/nfe-dist-dfe'
import { extractNfeAccessKey, nfeAccessKeyModel } from '@/lib/fiscal/nfe-access-key'
import { createPemSefazTransport } from '@/lib/fiscal/sefaz-transport'
import { onlyDigits } from '@/lib/utils/strings'

function publicSefazError (err: unknown) {
  const message = err instanceof Error ? err.message : 'Falha ao consultar a SEFAZ.'
  if (message.startsWith('Timeout')) return 'A SEFAZ demorou para responder. Tente de novo.'
  if (message.includes('<') || message.length > 280) {
    return 'Não foi possível consultar a SEFAZ. Tente de novo em instantes.'
  }
  return message.replace(/^SOAP Fault da SEFAZ:\s*/i, 'A SEFAZ recusou a consulta: ')
}

function recipientCnpj (xml: string) {
  const dest = xml.match(/<(?:[\w.-]+:)?dest\b[\s\S]*?<\/(?:[\w.-]+:)?dest>/i)?.[0] || ''
  return dest.match(/<(?:[\w.-]+:)?CNPJ>(\d{14})<\/(?:[\w.-]+:)?CNPJ>/i)?.[1] || null
}

export async function downloadInboundNfeXmlByAccessKey (
  auth: PortalAuthStaffSuccess,
  rawAccessKey: string,
) {
  const accessKey = extractNfeAccessKey(rawAccessKey)
  if (!accessKey) {
    return {
      ok: false as const,
      error: 'invalid_access_key' as const,
      message: 'A chave de acesso precisa ter 44 dígitos válidos. Leia o código de barras do DANFE.',
    }
  }
  if (nfeAccessKeyModel(accessKey) !== '55') {
    return {
      ok: false as const,
      error: 'invalid_model' as const,
      message: 'Esta chave não é de uma NF-e (modelo 55). Leia o código de barras do DANFE da nota do fornecedor.',
    }
  }

  const { data: profile } = await auth.supabase
    .from('organization_fiscal_profiles')
    .select('cnpj, state, fiscal_environment')
    .eq('organization_id', auth.organizationId)
    .maybeSingle()

  if (!profile) {
    return {
      ok: false as const,
      error: 'missing_fiscal_profile' as const,
      message: 'Complete o perfil fiscal da empresa antes de buscar a nota.',
    }
  }

  const uf = String(profile.state || '').trim().toUpperCase()
  const ufCode = NFE_UF_IBGE[uf]
  if (!ufCode) {
    return {
      ok: false as const,
      error: 'missing_uf' as const,
      message: 'Informe a UF da empresa no perfil fiscal.',
    }
  }

  const environment = profile.fiscal_environment === 'producao' ? 'producao' : 'homologacao'
  const certificate = await getFiscalCertificateSecret(auth.organizationId)
  if (!certificate.ok) {
    return {
      ok: false as const,
      error: 'missing_certificate' as const,
      message: certificate.error === 'not_found'
        ? 'Cadastre o certificado digital A1 da empresa.'
        : 'Não foi possível ler o certificado digital A1 da empresa.',
    }
  }
  if (isFiscalCertificateExpired(certificate.certificate.validUntil)) {
    return {
      ok: false as const,
      error: 'certificate_expired' as const,
      message: fiscalCertificateExpiredMessage(certificate.certificate.validUntil),
    }
  }

  const cnpj = onlyDigits(certificate.certificate.subjectCnpj || profile.cnpj || '')
  if (cnpj.length !== 14) {
    return {
      ok: false as const,
      error: 'missing_cnpj' as const,
      message: 'Informe o CNPJ da empresa no perfil fiscal.',
    }
  }

  let responseXml = ''
  try {
    const transport = createPemSefazTransport(
      certificate.certificate.pfxBuffer,
      certificate.certificate.password,
      20000,
    )
    const response = await transport.send({
      url: NFE_DIST_DFE_URL[environment],
      soapAction: NFE_DIST_DFE_SOAP_ACTION,
      xml: buildNfeDistDFeEnvelope({
        environment,
        ufCode,
        cnpj,
        accessKey,
      }),
      pfx: certificate.certificate.pfxBuffer,
      password: certificate.certificate.password,
    })
    responseXml = response.xml
  } catch (err) {
    console.error('[inbound-nfe] dist dfe lookup failed', err)
    return {
      ok: false as const,
      error: 'sefaz_unavailable' as const,
      message: publicSefazError(err),
    }
  }

  const parsed = parseNfeDistDFeResponse(responseXml)
  if (!parsed.ok) {
    if (parsed.error === 'not_found' && environment === 'homologacao') {
      return {
        ok: false as const,
        error: parsed.error,
        message: `${parsed.message} O ambiente fiscal da loja está em homologação. A nota do fornecedor é consultada em produção.`,
      }
    }
    return parsed
  }

  const destCnpj = recipientCnpj(parsed.xml)
  if (destCnpj && destCnpj !== cnpj) {
    return {
      ok: false as const,
      error: 'recipient_mismatch' as const,
      message: 'Esta NF-e não é destinada ao CNPJ da loja.',
    }
  }

  return { ok: true as const, xml: parsed.xml }
}
