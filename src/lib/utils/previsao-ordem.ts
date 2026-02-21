/**
 * Utilitários para o campo Previsão (data/hora) de ordem de serviço.
 * Todas as datas/horas são tratadas no fuso do Brasil (America/Sao_Paulo).
 */

const BRAZIL_TZ = 'America/Sao_Paulo'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/** Interpreta string datetime-local (YYYY-MM-DDTHH:mm) como horário no Brasil e retorna Date. */
export function parseDateTimeLocalAsBrazil(value: string): Date | null {
  const s = String(value).trim()
  if (!s) return null
  if (/Z$|[+-]\d{2}:\d{2}$/.test(s)) {
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s + '-03:00')
  return Number.isNaN(d.getTime()) ? null : d
}

/** Retorna o instante atual no Brasil no formato datetime-local (YYYY-MM-DDTHH:mm). */
export function getNowInBrazilAsDateTimeLocal(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(new Date())
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/** Converte uma Date (ex.: ISO do banco) para datetime-local no fuso Brasil. */
export function toDateTimeLocalInBrazil(d: Date): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZIL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

export function toDateTimeLocalString(d: Date): string {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${y}-${m}-${day}T${h}:${min}`
}

/** 2h à frente no Brasil, arredondado ao próximo 30 min. */
export function getDefaultPrevisao(): string {
  const now = parseDateTimeLocalAsBrazil(getNowInBrazilAsDateTimeLocal())
  if (!now) return getNowInBrazilAsDateTimeLocal()
  const d = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const m = d.getMinutes()
  d.setMinutes(m < 30 ? 30 : 0)
  if (m >= 30) d.setHours(d.getHours() + 1)
  return toDateTimeLocalInBrazil(d)
}

export function getMinPrevisaoNow(): string {
  return getNowInBrazilAsDateTimeLocal()
}

/**
 * Mínimo para o campo previsão na edição: data de abertura da OS no fuso Brasil.
 * Não usa "agora" para evitar que o horário do servidor (outro fuso) invalide um valor correto.
 */
export function getMinPrevisaoForEdit(createdAt: string | null | undefined): string {
  if (!createdAt) return getMinPrevisaoNow()
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return getMinPrevisaoNow()
  return toDateTimeLocalInBrazil(d)
}

export function isPrevisaoValid(
  value: string | null | undefined,
  minDateTime: string | null | undefined
): boolean {
  if (!value || !minDateTime) return true
  const t = parseDateTimeLocalAsBrazil(value)?.getTime()
  const minT = parseDateTimeLocalAsBrazil(minDateTime)?.getTime()
  if (t == null || minT == null) return true
  return t >= minT
}

/**
 * Para uso no servidor: interpreta o valor do formulário (datetime-local) como Brasil
 * e retorna ISO string para persistir, ou null se inválido.
 */
export function previsaoToISO(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null
  const d = parseDateTimeLocalAsBrazil(value.trim())
  return d ? d.toISOString() : null
}
