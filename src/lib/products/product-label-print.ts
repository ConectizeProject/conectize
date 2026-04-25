function escapeHtml (text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

export function buildProductLabelHtml (input: {
  name: string
  sku?: string | null
  barcode: string
}): string {
  const name = String(input.name || '').trim()
  const sku = String(input.sku || '').trim()
  const barcode = String(input.barcode || '').trim()

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta produto</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      font-family: Arial, sans-serif;
      color: #000;
      width: 45mm;
      min-height: 25mm;
      padding: 2mm 2mm 1.5mm;
      overflow: hidden;
    }
    .container {
      display: flex;
      height: 100%;
      flex-direction: column;
      justify-content: flex-start;
      gap: 1mm;
    }
    .name {
      font-size: 8.5px;
      line-height: 1.15;
      font-weight: 700;
      text-align: center;
      max-height: 7.2mm;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      word-break: break-word;
    }
    .sku {
      font-size: 8px;
      line-height: 1.1;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .barcode-wrap {
      display: flex;
      margin-top: auto;
      align-items: flex-end;
      justify-content: center;
      min-height: 0;
      padding-bottom: 0.2mm;
    }
    #barcode {
      width: 100%;
      height: 100%;
      max-height: 12mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: 45mm 25mm; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="name">${escapeHtml(name)}</div>
    <div class="sku">${escapeHtml(sku ? `SKU: ${sku}` : '')}</div>
    <div class="barcode-wrap">
      <svg id="barcode"></svg>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <script>
    (function () {
      var value = ${JSON.stringify(barcode)}
      function printNow () { setTimeout(function () { window.print() }, 80) }
      function onErr () {
        document.getElementById('barcode').outerHTML = '<div style="font-size:8px;text-align:center;">Código inválido</div>'
        printNow()
      }
      try {
        if (!value) return onErr()
        JsBarcode('#barcode', value, {
          format: 'CODE128',
          lineColor: '#000',
          width: 1.2,
          height: 34,
          displayValue: false,
          margin: 0,
        })
        printNow()
      } catch (e) {
        onErr()
      }
    })()
  </script>
</body>
</html>`
}

