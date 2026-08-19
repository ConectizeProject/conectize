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

function publicKeysMatch (cert: forge.pki.Certificate, key: forge.pki.rsa.PrivateKey) {
  const certKey = cert.publicKey as forge.pki.rsa.PublicKey | undefined
  if (!certKey?.n || !certKey?.e || !key.n || !key.e) return false
  return certKey.n.compareTo(key.n) === 0 && certKey.e.compareTo(key.e) === 0
}

function parsePkcs12 (pfxBuffer: Buffer, password: string) {
  const der = forge.util.createBuffer(bufferToBinaryString(pfxBuffer))
  const asn1 = forge.asn1.fromDer(der, false)
  return forge.pkcs12.pkcs12FromAsn1(asn1, false, password)
}

export type A1CertificateMaterial = {
  certPem: string
  chainPem: string
  privateKeyPem: string
  notAfter: Date
  notBefore: Date
}

/** PEM para mTLS no Node 18+: o OpenSSL 3 recusa PFX A1 legado (RC2/3DES). */
export function a1MaterialToMtls (material: A1CertificateMaterial) {
  return {
    cert: material.chainPem ? `${material.certPem}\n${material.chainPem}` : material.certPem,
    key: material.privateKeyPem,
  }
}

/** Abre o PFX A1 sem openssl.exe (necessário no Windows). */
export function loadA1CertificateMaterial (pfxBuffer: Buffer, password: string): A1CertificateMaterial {
  const p12 = parsePkcs12(pfxBuffer, password)
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ]
  const privateKey = keyBags
    .map((bag) => bag.key)
    .find((item): item is forge.pki.rsa.PrivateKey => Boolean(item))
  const certs = certBags
    .map((bag) => bag.cert)
    .filter((item): item is forge.pki.Certificate => Boolean(item))
  const leaf = (privateKey ? certs.find((item) => publicKeysMatch(item, privateKey)) : null) || certs[0]

  if (!leaf || !privateKey) {
    throw new Error('Certificado A1 sem chave ou certificado no arquivo PFX.')
  }

  const chain = certs.filter((item) => item !== leaf)

  return {
    certPem: forge.pki.certificateToPem(leaf),
    chainPem: chain.map((item) => forge.pki.certificateToPem(item)).join('\n'),
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    notAfter: leaf.validity.notAfter,
    notBefore: leaf.validity.notBefore,
  }
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
    const p12 = parsePkcs12(pfxBuffer, password)
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
