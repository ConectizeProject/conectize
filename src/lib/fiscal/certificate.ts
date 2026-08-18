import 'server-only'
import crypto from 'crypto'
import forge from 'node-forge'
import { onlyDigits } from '@/lib/utils/strings'

export const FISCAL_CERTIFICATE_MAX_BYTES = 2 * 1024 * 1024

export type FiscalCertificateMetadata = {
  subjectCommonName: string | null
  subjectCnpj: string | null
  validFrom: string | null
  validUntil: string | null
  fingerprintSha256: string
}

export type FiscalCertificateValidation =
  | { ok: true, metadata: FiscalCertificateMetadata }
  | { ok: false, error: 'invalid_file' | 'file_too_large' | 'invalid_password' | 'cnpj_mismatch' }

function bufferToBinaryString (buffer: Buffer): string {
  return buffer.toString('binary')
}

function subjectValue (cert: forge.pki.Certificate, name: string) {
  const field = cert.subject.getField(name)
  const value = field?.value
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function extractCnpjFromCertificate (commonName: string | null) {
  const digits = onlyDigits(commonName || '')
  if (digits.length < 14) return null
  return digits.slice(-14)
}

export function validateFiscalCertificate (
  pfxBuffer: Buffer,
  password: string,
  organizationCnpj?: string | null,
): FiscalCertificateValidation {
  if (!Buffer.isBuffer(pfxBuffer) || pfxBuffer.length <= 0) {
    return { ok: false, error: 'invalid_file' }
  }

  if (pfxBuffer.length > FISCAL_CERTIFICATE_MAX_BYTES) {
    return { ok: false, error: 'file_too_large' }
  }

  try {
    const asn1 = forge.asn1.fromDer(bufferToBinaryString(pfxBuffer))
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
    const firstCert = certBags
      .map((bag) => bag.cert)
      .find((cert): cert is forge.pki.Certificate => Boolean(cert))

    if (!firstCert) {
      return { ok: false, error: 'invalid_file' }
    }

    const subjectCommonName = subjectValue(firstCert, 'CN')
    const subjectCnpj = extractCnpjFromCertificate(subjectCommonName)
    const expectedCnpj = onlyDigits(organizationCnpj || '')
    if (expectedCnpj.length === 14 && subjectCnpj && subjectCnpj !== expectedCnpj) {
      return { ok: false, error: 'cnpj_mismatch' }
    }

    return {
      ok: true,
      metadata: {
        subjectCommonName,
        subjectCnpj,
        validFrom: firstCert.validity.notBefore?.toISOString() ?? null,
        validUntil: firstCert.validity.notAfter?.toISOString() ?? null,
        fingerprintSha256: crypto.createHash('sha256').update(pfxBuffer).digest('hex'),
      },
    }
  } catch {
    return { ok: false, error: 'invalid_password' }
  }
}
