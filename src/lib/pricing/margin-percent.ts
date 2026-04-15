/**
 * Só dígitos e no máximo um separador decimal (, ou . → exibido como ,).
 * Bloqueia letras, %, espaços e outros símbolos.
 */
export function sanitizeMarginPercentInput (raw: string): string {
  const s = raw.replace(/[^\d,.]/g, '')
  if (s === '') return ''
  let out = ''
  let sepUsed = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c >= '0' && c <= '9') {
      out += c
      continue
    }
    if ((c === ',' || c === '.') && !sepUsed) {
      out += ','
      sepUsed = true
    }
  }
  return out
}

/** Converte bps (1 bp = 0,01%) para exibição em porcentagem. */
export function marginBpsToPercentString (bps: number | null | undefined): string {
  if (bps == null) return ''
  const p = bps / 100
  if (Number.isInteger(p)) return String(p)
  return p.toFixed(2).replace('.', ',')
}

/** Aceita "50", "50,5" ou "50.5" → bps; vazio → null; inválido se fora de [0, 100). */
export function parsePercentInputToMarginBps (raw: string): number | null | 'invalid' {
  const s = raw.trim().replace('%', '').replace(/\s/g, '')
  if (!s) return null
  const n = Number(s.replace(',', '.'))
  if (!Number.isFinite(n) || n < 0 || n >= 100) return 'invalid'
  const bps = Math.round(n * 100)
  if (bps >= 10000) return 'invalid'
  return bps
}
