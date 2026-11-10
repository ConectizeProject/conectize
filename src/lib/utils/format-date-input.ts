import { onlyDigits } from '@/lib/utils/strings'

/** Máscara parcial dd/mm/yyyy enquanto digita. */
export function formatDateInputBr (value: string): string {
  const digits = onlyDigits(value).slice(0, 8)
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  if (!day) return ''
  if (!month) return day
  if (!year) return `${day}/${month}`
  return `${day}/${month}/${year}`
}

export function isValidYmd (value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

/** Converte dd/mm/yyyy completo em yyyy-mm-dd. Retorna '' se incompleto/inválido. */
export function brDateToYmd (value: string): string {
  const digits = onlyDigits(value)
  if (digits.length !== 8) return ''
  const day = digits.slice(0, 2)
  const month = digits.slice(2, 4)
  const year = digits.slice(4, 8)
  const ymd = `${year}-${month}-${day}`
  return isValidYmd(ymd) ? ymd : ''
}

/** Converte yyyy-mm-dd em dd/mm/yyyy. */
export function ymdToBrDate (value: string | null | undefined): string {
  const raw = String(value || '').trim().slice(0, 10)
  if (!isValidYmd(raw)) return ''
  const [year, month, day] = raw.split('-')
  return `${day}/${month}/${year}`
}

export function ymdToLocalDate (value: string | null | undefined): Date | undefined {
  const raw = String(value || '').trim().slice(0, 10)
  if (!isValidYmd(raw)) return undefined
  const [year, month, day] = raw.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function localDateToYmd (date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
