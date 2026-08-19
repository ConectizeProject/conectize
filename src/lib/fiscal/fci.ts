const FCI_HEX_RE = /[^0-9a-fA-F]/g

export function originRequiresFci (origin: unknown) {
  const n = Number(origin)
  return n === 3 || n === 5 || n === 8
}

export function maskFci (value: unknown) {
  const hex = String(value ?? '').replace(FCI_HEX_RE, '').slice(0, 32).toUpperCase()
  if (hex.length <= 8) return hex
  if (hex.length <= 12) return `${hex.slice(0, 8)}-${hex.slice(8)}`
  if (hex.length <= 16) return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12)}`
  if (hex.length <= 20) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16)}`
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** FCI da SEFAZ: UUID 8-4-4-4-12, em maiúsculas. */
export function fiscalFciOrNull (value: unknown): string | null {
  const hex = String(value ?? '').replace(FCI_HEX_RE, '').toUpperCase()
  if (hex.length !== 32) return null
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Vazio = sem FCI. Preenchido só aceita UUID. */
export function normalizeOptionalFci (value: unknown): string | null | 'invalid' {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  return fiscalFciOrNull(raw) ?? 'invalid'
}

export function injectProdNfci (
  xml: string,
  produtos: ReadonlyArray<{ nFCI?: string | null }>,
) {
  let index = 0
  return xml.replace(/<indTot>1<\/indTot>(<\/prod>)/g, (match, close: string) => {
    const fci = produtos[index]?.nFCI
    index += 1
    if (!fci) return match
    return `<indTot>1</indTot><nFCI>${fci}</nFCI>${close}`
  })
}
