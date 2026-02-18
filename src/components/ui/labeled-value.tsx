'use client'

type Props = {
  label: string
  value: React.ReactNode | null | undefined
}

/** Exibe "label: value" apenas quando value existe e não está vazio */
export function LabeledValue({ label, value }: Props) {
  if (value == null || value === '' || value === '-') return null
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}:</span>{' '}
      <span>{value}</span>
    </div>
  )
}
