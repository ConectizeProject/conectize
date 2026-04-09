export const SEMINOVOS_COLOR_MAP: Record<string, { bg: string; text: string }> = {
  preto: { bg: '#1a1a1a', text: '#fff' },
  negro: { bg: '#1a1a1a', text: '#fff' },
  black: { bg: '#1a1a1a', text: '#fff' },
  branco: { bg: '#e0e0e0', text: '#1a1a1a' },
  white: { bg: '#e0e0e0', text: '#1a1a1a' },
  prateado: { bg: '#c0c0c0', text: '#1a1a1a' },
  silver: { bg: '#c0c0c0', text: '#1a1a1a' },
  dourado: { bg: '#eab308', text: '#1a1a1a' },
  gold: { bg: '#eab308', text: '#1a1a1a' },
  azul: { bg: '#3b82f6', text: '#fff' },
  blue: { bg: '#3b82f6', text: '#fff' },
  verde: { bg: '#22c55e', text: '#fff' },
  green: { bg: '#22c55e', text: '#fff' },
  rosa: { bg: '#f9a8d4', text: '#831843' },
  pink: { bg: '#f9a8d4', text: '#831843' },
  vermelho: { bg: '#ef4444', text: '#fff' },
  red: { bg: '#ef4444', text: '#fff' },
  cinza: { bg: '#6b7280', text: '#fff' },
  gray: { bg: '#6b7280', text: '#fff' },
  grafite: { bg: '#374151', text: '#fff' },
  graphite: { bg: '#374151', text: '#fff' },
  roxo: { bg: '#a855f7', text: '#fff' },
  purple: { bg: '#a855f7', text: '#fff' },
  amarelo: { bg: '#eab308', text: '#1a1a1a' },
  yellow: { bg: '#eab308', text: '#1a1a1a' },
  laranja: { bg: '#f97316', text: '#fff' },
  orange: { bg: '#f97316', text: '#fff' },
  coral: { bg: '#fb7185', text: '#fff' },
  midnight: { bg: '#1e3a5f', text: '#fff' },
  'meia-noite': { bg: '#1e3a5f', text: '#fff' },
  natural: { bg: '#d8d8b8', text: '#1a1a1a' },
  'titânio': { bg: '#71717a', text: '#fff' },
  titanium: { bg: '#71717a', text: '#fff' },
  starlight: { bg: '#e5e0d8', text: '#2c2825' },
}

export function getSeminovosColorStyle(cor: string): { bg: string; text: string } {
  const key = cor.trim().toLowerCase().replace(/\s+/g, '-')
  const direct = SEMINOVOS_COLOR_MAP[key]
  if (direct) return direct
  const words = key.split(/-| /)
  for (const w of words) {
    const found = SEMINOVOS_COLOR_MAP[w]
    if (found) return found
  }
  return { bg: '#6366f1', text: '#fff' }
}

const SEMINOVOS_COLOR_EMOJI: Record<string, string> = {
  preto: '⚫',
  negro: '⚫',
  black: '⚫',
  branco: '⚪',
  white: '⚪',
  prateado: '🩶',
  silver: '🩶',
  dourado: '🟡',
  gold: '🟡',
  azul: '🔵',
  blue: '🔵',
  verde: '🟢',
  green: '🟢',
  rosa: '🩷',
  pink: '🩷',
  vermelho: '🔴',
  red: '🔴',
  cinza: '⬜',
  gray: '⬜',
  grafite: '⬛',
  graphite: '⬛',
  roxo: '🟣',
  purple: '🟣',
  amarelo: '🟡',
  yellow: '🟡',
  laranja: '🟠',
  orange: '🟠',
  coral: '🪸',
  midnight: '🌑',
  'meia-noite': '🌑',
  natural: '🟤',
  'titânio': '🔘',
  titanium: '🔘',
  starlight: '✨',
}

/** Emoji representando a cor (WhatsApp / listagens). Sem cor cadastrada: 📱 */
export function getSeminovosColorEmoji(cor: string | null | undefined): string {
  const raw = (cor || '').trim()
  if (!raw) return '📱'
  const key = raw.toLowerCase().replace(/\s+/g, '-')
  const direct = SEMINOVOS_COLOR_EMOJI[key]
  if (direct) return direct
  const words = key.split(/-| /)
  for (const w of words) {
    const found = SEMINOVOS_COLOR_EMOJI[w]
    if (found) return found
  }
  return '🔷'
}

