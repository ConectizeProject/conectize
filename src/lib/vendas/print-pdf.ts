export function printPdfBase64 (pdfBase64: string): void {
  const raw = String(pdfBase64 || '').trim()
  if (!raw) throw new Error('pdf_empty')

  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.src = url
  document.body.appendChild(iframe)

  const cleanup = () => {
    try {
      iframe.remove()
    } catch {
      // ignore
    }
    URL.revokeObjectURL(url)
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    window.setTimeout(cleanup, 60_000)
  }
}

export function pdfPrintErrorMessage (error: unknown): string {
  const code = error instanceof Error ? error.message : String(error || '')
  if (code === 'pdf_empty') return 'PDF da etiqueta vazio.'
  return 'Não foi possível abrir a impressão do PDF.'
}
