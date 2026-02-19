/**
 * Utilitários para o campo Previsão (data/hora) de ordem de serviço.
 */

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toDateTimeLocalString(d: Date): string {
  const y = d.getFullYear()
  const m = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const h = pad(d.getHours())
  const min = pad(d.getMinutes())
  return `${y}-${m}-${day}T${h}:${min}`
}

/** 2h à frente, arredondado ao próximo 30 min. */
export function getDefaultPrevisao(): string {
  const d = new Date()
  d.setTime(d.getTime() + 2 * 60 * 60 * 1000)
  const m = d.getMinutes()
  d.setMinutes(m < 30 ? 30 : 0)
  if (m >= 30) d.setHours(d.getHours() + 1)
  return toDateTimeLocalString(d)
}

export function getMinPrevisaoNow(): string {
  return toDateTimeLocalString(new Date())
}

export function getMinPrevisaoForEdit(createdAt: string | null | undefined): string {
  if (!createdAt) return getMinPrevisaoNow()
  const d = new Date(createdAt)
  return Number.isNaN(d.getTime()) ? getMinPrevisaoNow() : toDateTimeLocalString(d)
}

export function isPrevisaoValid(
  value: string | null | undefined,
  minDateTime: string | null | undefined
): boolean {
  if (!value || !minDateTime) return true
  const t = new Date(value).getTime()
  const minT = new Date(minDateTime).getTime()
  if (Number.isNaN(t) || Number.isNaN(minT)) return true
  return t >= minT
}
