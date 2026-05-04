import { getSeminovosColorEmoji } from '@/lib/seminovos/colors'
import { getModelSortKey } from '@/lib/seminovos/group-devices-by-model'

/** Campos mínimos para agrupar modelo/armazenamento/cores no texto de estoque. */
export type WhatsAppStockDeviceLike = {
  device_name: string | null
  storage_gb: string | null
  color: string | null
  wholesale_value_cents: number | null
  sale_value_cents: number | null
}

type WhatsAppModelRow = {
  name: string
  storage: string
  minCents: number
  maxCents: number
  colorsByKey: Map<string, string>
}

/** Exibe valor em reais sem centavos (arredondado), ex.: 2700 → 2.700 */
function centsToReaisInteiro (cents: number): string {
  return Math.round(cents / 100).toLocaleString('pt-BR')
}

function buildWhatsAppModelRows (
  list: WhatsAppStockDeviceLike[],
  getPriceCents: (d: WhatsAppStockDeviceLike) => number | null | undefined,
): WhatsAppModelRow[] {
  const map = new Map<string, WhatsAppModelRow>()
  for (const d of list) {
    const price = getPriceCents(d) ?? 0
    if (price <= 0) continue
    const name = (d.device_name || '').trim() || 'Aparelho'
    const storageRaw = d.storage_gb ? `${String(d.storage_gb).trim()}gb` : ''
    const storage = storageRaw.toLowerCase()
    const key = `${name}|${storage}`
    const colorRaw = (d.color || '').trim()
    const existing = map.get(key)
    if (existing === undefined) {
      const colorsByKey = new Map<string, string>()
      if (colorRaw) colorsByKey.set(colorRaw.toLowerCase(), colorRaw)
      map.set(key, {
        name,
        storage,
        minCents: price,
        maxCents: price,
        colorsByKey,
      })
    } else {
      existing.minCents = Math.min(existing.minCents, price)
      existing.maxCents = Math.max(existing.maxCents, price)
      if (colorRaw) {
        const ck = colorRaw.toLowerCase()
        if (!existing.colorsByKey.has(ck)) {
          existing.colorsByKey.set(ck, colorRaw)
        }
      }
    }
  }
  const entries = Array.from(map.values())
  entries.sort((a, b) => {
    const keyA = getModelSortKey(a.name)
    const keyB = getModelSortKey(b.name)
    if (keyA !== keyB) return keyA - keyB
    const storageA = Number.parseInt(a.storage.replace(/\D/g, ''), 10) || 0
    const storageB = Number.parseInt(b.storage.replace(/\D/g, ''), 10) || 0
    if (storageA !== storageB) return storageA - storageB
    return a.name.localeCompare(b.name)
  })
  return entries
}

function formatWhatsAppDevicesBlock (rows: WhatsAppModelRow[]): string {
  if (rows.length === 0) return '(Nenhum aparelho disponível)'
  return rows
    .map((e) => {
      const colorLabels = [...e.colorsByKey.values()].sort((a, b) =>
        a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
      )
      const colorTokens =
        colorLabels.length > 0
          ? ` · ${colorLabels
            .map((label) => {
              const emoji = getSeminovosColorEmoji(label)
              return `\`${label} ${emoji}\``
            })
            .join(' ')}`
          : ''
      const linha1 = e.storage
        ? `*${e.name}* \`${e.storage}\`${colorTokens}`
        : `*${e.name}*${colorTokens}`
      const preco =
        e.minCents === e.maxCents
          ? `R$ ${centsToReaisInteiro(e.minCents)}`
          : `R$ ${centsToReaisInteiro(e.minCents)} ~ R$ ${centsToReaisInteiro(e.maxCents)}`
      return `${linha1}\n${preco}`
    })
    .join('\n\n')
}

export type ConectizeStockWhatsAppTexts = {
  atacado: string
  cliente: string
}

/**
 * Mesmo formato da listagem operacional de seminovos: blocos por modelo,
 * preços agregados e textos legais fixos.
 */
export function buildConectizeStockWhatsAppTexts (
  availableDevices: WhatsAppStockDeviceLike[],
): ConectizeStockWhatsAppTexts {
  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`
  const atacadoEntries = buildWhatsAppModelRows(
    availableDevices,
    (d) => d.wholesale_value_cents,
  )
  const clienteEntries = buildWhatsAppModelRows(
    availableDevices,
    (d) => d.sale_value_cents,
  )
  const devicesBlockAtacado = formatWhatsAppDevicesBlock(atacadoEntries)
  const devicesBlockCliente = formatWhatsAppDevicesBlock(clienteEntries)
  const textAtacado = `🟢 CONECTIZE ATACADO 🟢
📅 Estoque atualizado – ${dateStr}

🚨 LIBERADO HOJE

📦 MODELOS DISPONÍVEIS:

${devicesBlockAtacado}

🔒 Seminovos revisados
✅ Garantia 90 dias
⚠️ Reservas mediante pagamento integral do aparelho

🚨 PROMOÇÃO ESPECIAL
Comprando 3 iPhones
💰 R$100 OFF no total

📲 Garanta o seu no privado`
  const textCliente = `🔵 CONECTIZE 🔵
📅 Estoque atualizado – ${dateStr}

📱 APARELHOS DISPONÍVEIS:

${devicesBlockCliente}

🔒 Seminovos testados e com garantia
✅ Garantia 90 dias
⚠️ Reservas mediante pagamento integral do aparelho

📲 Chame no privado e garanta o seu`
  return { atacado: textAtacado, cliente: textCliente }
}
