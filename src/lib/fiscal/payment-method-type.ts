export const NFCE_PAYMENT_TYPES = ['dinheiro', 'pix', 'credito', 'debito', 'outro'] as const

export type NfcePaymentType = (typeof NFCE_PAYMENT_TYPES)[number]

export const NFCE_PAYMENT_TYPE_LABELS: Record<NfcePaymentType, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  outro: 'Outro',
}

export function isNfcePaymentType (value: unknown): value is NfcePaymentType {
  return NFCE_PAYMENT_TYPES.includes(String(value || '') as NfcePaymentType)
}

export function nfcePaymentTypeFromCatalog (type: unknown): NfcePaymentType {
  const value = String(type || '').trim()
  if (value === 'pix_direto' || value === 'pix_maquina' || value === 'pix') return 'pix'
  if (value === 'credito' || value === 'debito' || value === 'dinheiro') return value
  return 'outro'
}
