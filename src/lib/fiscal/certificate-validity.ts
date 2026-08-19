export function fiscalCertificateValidUntil (value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isFinite(date.getTime()) ? date : null
}

export function isFiscalCertificateExpired (validUntil: unknown, now = new Date()) {
  const date = fiscalCertificateValidUntil(validUntil)
  if (!date) return false
  return date.getTime() < now.getTime()
}

export function fiscalCertificateExpiredMessage (validUntil: unknown) {
  const date = fiscalCertificateValidUntil(validUntil)
  if (!date) {
    return 'O certificado digital A1 está vencido. Envie um certificado válido em Dados da empresa > Fiscal.'
  }
  const when = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `O certificado digital A1 venceu em ${when}. Envie um certificado válido em Dados da empresa > Fiscal.`
}

export function isNfceServiceItem (kind: unknown) {
  return String(kind || '').trim().toLowerCase() === 'service'
}
