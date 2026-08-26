/** Data civil (YYYY-MM-DD) no fuso de Brasília. */
export function saoPauloYmd (from: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(from)
}

/** Soma dias a uma data YYYY-MM-DD (calendário, sem fuso). */
export function addDaysYmd (ymd: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || '').trim())
  if (!m) return saoPauloYmd()
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

/** Validade padrão: hoje (Brasília) + 7 dias. */
export function defaultQuoteValidUntilYmd (from: Date = new Date()): string {
  return addDaysYmd(saoPauloYmd(from), 7)
}

export function isValidYmd (value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}
