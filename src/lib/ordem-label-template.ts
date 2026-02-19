/**
 * Modelo de etiqueta para Ordem de Serviço.
 * Tamanho: 45mm x 25mm
 * Conteúdo: título, entrada, previsão, senha do cliente
 */

export type OrdemLabelData = {
  displayNumber: string | number
  title: string
  createdAt: string
  estimatedReadyAt: string | null
  passcodeType: 'text' | 'pattern' | null
  passcodeText: string | null
  passcodePattern: string | null
  customerFirstName: string | null
  customerMobile: string | null
  deviceModel: string | null
}

/** Formata data no padrão brasileiro: dd/mm/aaaa, hh:mm */
function formatDateShort(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatPhoneBr(value: string | null | undefined): string | null {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '').slice(0, 11)
  const ddd = digits.slice(0, 2)
  const rest = digits.slice(2)
  if (!ddd) return value
  if (rest.length <= 8) {
    const p1 = rest.slice(0, 4)
    const p2 = rest.slice(4, 8)
    return `(${ddd}) ${[p1, p2].filter(Boolean).join('-')}`.trim()
  }
  const p1 = rest.slice(0, 1)
  const p2 = rest.slice(1, 5)
  const p3 = rest.slice(5, 9)
  return `(${ddd}) ${p1} ${[p2, p3].filter(Boolean).join('-')}`.trim()
}

function getPasscodeDisplay(data: OrdemLabelData): string {
  if (data.passcodeType === 'text' && data.passcodeText) {
    return `Senha: ${data.passcodeText}`
  }
  if (data.passcodeType === 'pattern') {
    return data.passcodePattern
      ? `Senha (padrão): ${data.passcodePattern}`
      : 'Senha: padrão'
  }
  return ''
}

/**
 * Gera o HTML da etiqueta para impressão.
 */
export function buildOrdemLabelHtml(data: OrdemLabelData): string {
  const titleDisplay = `#${data.displayNumber} - ${(data.title || '-').slice(0, 35)}`
  const entrada = formatDateShort(data.createdAt)
  const previsao = formatDateShort(data.estimatedReadyAt)
  const senha = getPasscodeDisplay(data)
  const clienteLinha =
    data.customerFirstName || data.customerMobile
      ? [data.customerFirstName, data.customerMobile ? formatPhoneBr(data.customerMobile) : null]
        .filter(Boolean)
        .join(' ')
      : null;
  const modeloLinha = data.deviceModel || null;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Etiqueta OS</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9px;
      line-height: 1.25;
      color: #000;
      width: 45mm;
      min-height: 25mm;
      padding: 2mm 3mm;
      overflow: hidden;
      word-wrap: break-word;
    }
    .label-row { margin-bottom: 1mm; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-row.label-title { font-weight: 700; font-size: 9px; white-space: normal; word-break: break-word; }
    .label-row:last-child { margin-bottom: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 45mm 25mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="label-row label-title">${escapeHtml(titleDisplay)}</div>
  ${clienteLinha ? `<div class="label-row">${escapeHtml(clienteLinha)}</div>` : ''}
  ${modeloLinha ? `<div class="label-row">${escapeHtml(modeloLinha)}</div>` : ''}
  <div class="label-row">${escapeHtml(entrada)} | ${escapeHtml(previsao)}</div>
  <div class="label-row">${escapeHtml(senha)}</div>
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
`
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}
