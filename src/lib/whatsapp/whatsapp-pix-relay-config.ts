import { normalizeWaFrom, normalizeWaConversationKey } from '@/lib/whatsapp/wa-conversation-key'

const DEFAULT_GROUP_JID = '120363420741579781@g.us'
const DEFAULT_OWNER_DIGITS = '553181024092'

const DEFAULT_ALLOWED_DIGITS = [
  '553192576709',
  '553186140889',
  '553193557379',
  '553181024092',
]

export type WhatsappPixRelayConfig = {
  enabled: boolean
  /** Se definido, relay /pix só na instância Evolution com este nome (ex.: Victor). */
  instanceName: string | null
  pixGroupJid: string
  ownerDigits: string
  allowedSenderDigits: Set<string>
}

function parseAllowedFromEnv (): string[] {
  const raw = process.env.WHATSAPP_PIX_RELAY_ALLOWED?.trim()
  if (!raw) return DEFAULT_ALLOWED_DIGITS
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean)
}

export function getWhatsappPixRelayConfig (): WhatsappPixRelayConfig {
  const enabled = process.env.WHATSAPP_PIX_RELAY_ENABLED !== 'false'
  const instanceName =
    process.env.WHATSAPP_PIX_RELAY_INSTANCE_NAME?.trim().toLowerCase() || null
  const pixGroupJid =
    normalizeWaConversationKey(
      process.env.WHATSAPP_PIX_RELAY_GROUP_JID?.trim() || DEFAULT_GROUP_JID,
    ) || DEFAULT_GROUP_JID

  const allowedSenderDigits = new Set(parseAllowedFromEnv())
  const ownerDigits =
    process.env.WHATSAPP_PIX_RELAY_OWNER?.replace(/\D/g, '') || DEFAULT_OWNER_DIGITS

  return { enabled, instanceName, pixGroupJid, ownerDigits, allowedSenderDigits }
}

/** Instância do webhook deve bater com WHATSAPP_PIX_RELAY_INSTANCE_NAME (se definido) e com o hub no portal. */
export function isPixRelayInstance (
  evolutionInstance: string,
  config: WhatsappPixRelayConfig,
): boolean {
  if (!config.instanceName) return true
  return evolutionInstance.trim().toLowerCase() === config.instanceName
}

/** Para onde enviar a chave PIX e confirmações (E.164 ou JID de grupo). */
export function pixRelayReplyTarget (
  conversationKey: string,
  config: WhatsappPixRelayConfig,
): string {
  if (conversationKey.includes('@g.us')) return conversationKey
  const digits = waKeyToDigits(conversationKey)
  if (digits.length >= 10) {
    const normalized = normalizeWaFrom(conversationKey)
    if (normalized) return normalized
  }
  if (config.ownerDigits) {
    return normalizeWaFrom(`+${config.ownerDigits}`) || conversationKey
  }
  return conversationKey
}

export function waKeyToDigits (waKey: string): string {
  return String(waKey || '').replace(/\D/g, '')
}

export function isPixRelayAllowedSender (
  conversationKey: string,
  allowed: Set<string>,
): boolean {
  const digits = waKeyToDigits(conversationKey)
  if (!digits) return false
  return allowed.has(digits)
}

export function formatPixAmountDisplay (amountRaw: string): string {
  const normalized = amountRaw.replace(',', '.')
  const n = Number.parseFloat(normalized)
  if (!Number.isFinite(n)) return amountRaw
  return n.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** Valor no formato do comando: `100` ou `100,50` (vírgula, sem espaço). */
export function canonicalPixAmount (amountRaw: string): string {
  const raw = amountRaw.trim().replace('.', ',')
  const n = Number.parseFloat(raw.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return raw
  if (!raw.includes(',')) return String(Math.trunc(n))
  const [intPart, frac = ''] = raw.split(',')
  return `${intPart},${frac}`
}

/** Ex.: `2470` → `/gerarPix2470` · `100,50` → `/gerarPix100,50` (sem `,00` em inteiro). */
export function buildGerarPixCommand (amountRaw: string): string {
  return `/gerarPix${canonicalPixAmount(amountRaw)}`
}
