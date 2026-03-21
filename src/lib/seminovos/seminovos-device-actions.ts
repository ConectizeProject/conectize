import { maskedFromCents } from '@/lib/utils/money'

/** Taxa fixa (%) para cálculo de parcelamento em 12x no crédito (copiar dados cliente) */
export const TAXA_12X_CREDITO_PERCENT = 13.4

export type SeminovoActionDevice = {
  device_name: string | null
  storage_gb: string | null
  color: string | null
  battery: string | null
  condition: string | null
  info: string | null
  imei: string | null
  wholesale_value_cents: number | null
  sale_value_cents: number | null
}

export function calc12xCredito (receiveCents: number): { chargeCents: number; valuePerInstallmentCents: number } | null {
  if (receiveCents <= 0 || TAXA_12X_CREDITO_PERCENT >= 100) return null
  const chargeCents = Math.round(receiveCents / (1 - TAXA_12X_CREDITO_PERCENT / 100))
  const valuePerInstallmentCents = Math.round(chargeCents / 12)
  return { chargeCents, valuePerInstallmentCents }
}

export function buildCopyLojistaText (d: SeminovoActionDevice): string {
  const aparelho = [
    d.device_name || '',
    d.storage_gb ? `${d.storage_gb}GB` : '',
    d.color || '',
  ]
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(' • ')

  const valorCents = d.wholesale_value_cents ?? d.sale_value_cents ?? 0
  const infoText = d.info != null ? String(d.info).trim() : ''
  const lines: string[] = [
    aparelho,
    d.battery ? `Bateria: ${d.battery}` : '',
    d.condition ? `Estado: ${d.condition}` : '',
    infoText ? `Informações: ${infoText}` : '',
    d.imei ? `IMEI: ${d.imei}` : '',
  ]
  if (valorCents > 0) {
    lines.push(`Valor: R$ ${maskedFromCents(valorCents)}`)
  }

  return lines.filter(Boolean).join('\n')
}

export function buildCopyClienteText (d: SeminovoActionDevice): string {
  const aparelho = [
    d.device_name || '',
    d.storage_gb ? `${d.storage_gb}GB` : '',
    d.color || '',
  ]
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(' • ')

  const valorCents = d.sale_value_cents ?? d.wholesale_value_cents ?? 0
  const lines: string[] = [
    aparelho,
    d.battery ? `Bateria: ${d.battery}` : '',
  ]
  if (valorCents > 0) {
    lines.push(`Valor: R$ ${maskedFromCents(valorCents)}`)
    const r12 = calc12xCredito(valorCents)
    if (r12) {
      lines.push(`ou 12x de R$ ${maskedFromCents(r12.valuePerInstallmentCents)}`)
    }
  }

  return lines.filter(Boolean).join('\n')
}

export function buildSeminovoLabelHtml (d: SeminovoActionDevice): string {
  const title = d.device_name || ''
  const infoLine = d.info || ''
  const specParts = [d.storage_gb ? `${d.storage_gb}GB` : '', d.color || '', d.battery || '', d.condition || '']
    .map((p) => String(p).trim())
    .filter(Boolean)
  const specLine = specParts.join(' • ')
  const imei = d.imei || ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charSet="utf-8" />
  <title>Etiqueta seminovo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9px;
      line-height: 1.25;
      color: #000;
      width: 45mm;
      height: 25mm;
      padding: 2mm 3mm;
    }
    .container{
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
    }
    .label-row {
      margin-bottom: 1mm;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-align: center;
    }
    .label-row.label-title {
      font-weight: 700;
      font-size: 13px;
      white-space: normal;
      word-break: break-word;
    }
    .label-row.label-imei {
      font-size: 15px;
      font-weight: 700;
    }
    .label-row:last-child { margin-bottom: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 45mm 25mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="label-row label-title">${title}</div>
    <div class="label-row">${specLine}</div>
    <div class="label-row">${infoLine}</div>
    <div class="label-row label-imei">${imei}</div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`
}
