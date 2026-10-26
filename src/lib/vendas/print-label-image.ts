export function printPngBase64 (pngBase64: string): void {
  const raw = String(pngBase64 || '').trim()
  if (!raw) throw new Error('png_empty')

  const src = `data:image/png;base64,${raw}`
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    throw new Error('print_frame_unavailable')
  }

  doc.open()
  doc.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiqueta</title>
  <style>
    @page { margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
  </style>
</head>
<body>
  <img id="label" src="${src}" alt="Etiqueta" />
</body>
</html>`)
  doc.close()

  const cleanup = () => {
    try {
      iframe.remove()
    } catch {
      // ignore
    }
  }

  const img = doc.getElementById('label') as HTMLImageElement | null
  const runPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      window.setTimeout(cleanup, 60_000)
    }
  }

  if (img && !img.complete) {
    img.onload = runPrint
    img.onerror = cleanup
  } else {
    runPrint()
  }
}
