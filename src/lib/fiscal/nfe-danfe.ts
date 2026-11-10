import 'server-only'
import sharp from 'sharp'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { GerarDanfeUseCase } from '@brasil-fiscal/nfe'
import { parseNFeXml } from '@brasil-fiscal/nfe/dist/infra/danfe/xml-parser'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { asDownloadableNfceXml } from '@/lib/fiscal/sefaz-consulta'
import { resolveAllowedOrganizationLogoFetchUrl } from '@/lib/organizations/organization-logo-url'

export function nfeDanfePdfFilename (
  accessKey: string | null | undefined,
  series?: number,
  number?: number,
) {
  const key = String(accessKey || '').replace(/\D/g, '')
  if (key.length === 44) return `DANFE-NFe-${key}.pdf`
  const serie = Number(series) || 0
  const n = Number(number) || 0
  if (serie > 0 && n > 0) return `DANFE-NFe-${serie}-${String(n).padStart(9, '0')}.pdf`
  return 'DANFE-NFe.pdf'
}

function resolveLogoFetchUrl (logoUrl: string) {
  return resolveAllowedOrganizationLogoFetchUrl(logoUrl)
}

function fmtCep (cep: string) {
  const digits = String(cep || '').replace(/\D/g, '')
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return String(cep || '').trim()
}

function wrapText (font: PDFFont, text: string, size: number, maxWidth: number) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [] as string[]
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines
}

function safeDrawText (
  page: PDFPage,
  text: string,
  opts: { x: number, y: number, size: number, font: PDFFont, color?: ReturnType<typeof rgb> },
) {
  try {
    page.drawText(text, opts)
  } catch {
    page.drawText(text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''), opts)
  }
}

async function loadOrganizationLogoPng (
  auth: PortalAuthStaffSuccess,
): Promise<Buffer | null> {
  const { data, error } = await auth.supabase
    .from('organizations')
    .select('logo_url')
    .eq('id', auth.organizationId)
    .maybeSingle()
  if (error) return null

  const fetchUrl = resolveLogoFetchUrl(String(data?.logo_url || ''))
  if (!fetchUrl) return null

  try {
    const res = await fetch(fetchUrl, {
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length < 32 || bytes.length > 2_000_000) return null
    return await sharp(bytes)
      .rotate()
      .png()
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .toBuffer()
  } catch (err) {
    console.error('[nfe-danfe] logo fetch failed', err)
    return null
  }
}

async function restampEmitenteBox (
  pdf: Buffer,
  xml: string,
  logoPng: Buffer | null,
): Promise<Buffer> {
  const danfe = parseNFeXml(xml)
  const emitente = danfe.emitente
  const pdfDoc = await PDFDocument.load(pdf)
  const page = pdfDoc.getPage(0)
  const { width: pageW, height: pageH } = page.getSize()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const margin = 28
  const contentW = pageW - margin * 2
  const headerTopFromTop = margin + 55 + 18 + 10
  const headerH = 90
  const emitenteW = contentW * 0.35
  const boxLeft = margin
  const boxBottom = pageH - headerTopFromTop - headerH
  const inset = 1.2

  page.drawRectangle({
    x: boxLeft + inset,
    y: boxBottom + inset,
    width: emitenteW - inset * 2,
    height: headerH - inset * 2,
    color: rgb(1, 1, 1),
  })

  const pad = 5
  const innerLeft = boxLeft + pad
  const innerRight = boxLeft + emitenteW - pad
  const innerBottom = boxBottom + pad
  const innerTop = boxBottom + headerH - pad
  const innerH = innerTop - innerBottom
  const innerW = innerRight - innerLeft

  let textLeft = innerLeft
  let textWidth = innerW

  if (logoPng) {
    const image = await pdfDoc.embedPng(logoPng)
    const logoPad = 8
    const maxLogo = Math.min(48, innerH - logoPad * 2)
    const scale = Math.min(maxLogo / image.width, maxLogo / image.height)
    const logoW = image.width * scale
    const logoH = image.height * scale
    const logoX = innerLeft + logoPad
    const logoY = innerBottom + (innerH - logoH) / 2
    page.drawImage(image, { x: logoX, y: logoY, width: logoW, height: logoH })
    textLeft = logoX + logoW + logoPad
    textWidth = innerRight - textLeft
  }

  const nameSize = 8
  const bodySize = 6.5
  const nameLh = 10
  const bodyLh = 8.2
  const name = String(emitente.nome || '').trim()
  const fantasia = String(emitente.fantasia || '').trim()
  const bodySource = [
    fantasia && fantasia !== name ? fantasia : '',
    emitente.endereco,
    emitente.bairro,
    [emitente.cidade, emitente.uf, fmtCep(emitente.cep)].filter(Boolean).join(' - '),
    emitente.fone ? `Fone/Fax: ${emitente.fone}` : '',
  ].filter(Boolean)

  const nameLines = wrapText(fontBold, name, nameSize, textWidth)
  const bodyLines = bodySource.flatMap((line) => wrapText(font, line, bodySize, textWidth))
  const blockH = nameLines.length * nameLh + bodyLines.length * bodyLh
  let y = innerTop - Math.max(0, (innerH - blockH) / 2)

  for (const line of nameLines) {
    y -= nameSize
    safeDrawText(page, line, {
      x: textLeft,
      y,
      size: nameSize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
    y -= nameLh - nameSize
  }
  for (const line of bodyLines) {
    y -= bodySize
    safeDrawText(page, line, {
      x: textLeft,
      y,
      size: bodySize,
      font,
      color: rgb(0, 0, 0),
    })
    y -= bodyLh - bodySize
  }

  restampSectionTitles(pdfDoc, collectDanfeSectionTitles(danfe), fontBold)
  restampProductDescriptions(pdfDoc, danfe, font)

  return Buffer.from(await pdfDoc.save())
}

const DANFE_MARGIN = 28
const DANFE_PAGE_H = 841.89
const DANFE_ROW_H = 22
const DANFE_LINE_H = 10
const DANFE_TITLE_H = 10
const DANFE_TITLE_SIZE = 6
const DANFE_TITLE_PAD = 3

type DanfeSectionTitle = {
  page: number
  yFromTop: number
  title: string
}

function collectDanfeSectionTitles (data: ReturnType<typeof parseNFeXml>): DanfeSectionTitle[] {
  const titles: DanfeSectionTitle[] = []
  let page = 0
  let y = DANFE_MARGIN
  y += 55 + 18 + 10
  y += 90
  y += DANFE_ROW_H
  y += DANFE_ROW_H

  const push = (title: string) => {
    titles.push({ page, yFromTop: y, title })
    y += DANFE_TITLE_H
  }

  push('DESTINATARIO / REMETENTE')
  y += DANFE_ROW_H * 3

  if (data.fatura) {
    y += 2
    push('FATURA')
    y += 8 + DANFE_ROW_H
  }
  if (data.duplicatas && data.duplicatas.length > 0) {
    y += 2
    push('DUPLICATAS')
    y += DANFE_ROW_H
  }
  if (data.pagamentos.length > 0) {
    y += 2
    push('PAGAMENTO')
    y += DANFE_ROW_H
  }

  y += 2
  push('CALCULO DO IMPOSTO')
  y += DANFE_ROW_H * 2

  y += 2
  push('TRANSPORTADOR / VOLUMES TRANSPORTADOS')
  y += DANFE_ROW_H * 3

  y += 2
  push('DADOS DOS PRODUTOS / SERVICOS')
  y += 18
  for (let i = 0; i < data.produtos.length; i += 1) {
    if (y + DANFE_LINE_H > DANFE_PAGE_H - DANFE_MARGIN - 80) {
      page += 1
      y = DANFE_MARGIN
    }
    y += DANFE_LINE_H
  }

  y += 2
  push('DADOS ADICIONAIS')
  return titles
}

function restampSectionTitles (
  pdfDoc: PDFDocument,
  titles: DanfeSectionTitle[],
  fontBold: PDFFont,
) {
  const pages = pdfDoc.getPages()
  for (const item of titles) {
    const page = pages[item.page]
    if (!page) continue
    const { width: pageW, height: pageH } = page.getSize()
    const contentW = pageW - DANFE_MARGIN * 2
    const barBottom = pageH - item.yFromTop - DANFE_TITLE_H
    page.drawRectangle({
      x: DANFE_MARGIN,
      y: barBottom,
      width: contentW,
      height: DANFE_TITLE_H,
      color: rgb(1, 1, 1),
    })
    const baseline = pageH - item.yFromTop - 2 - DANFE_TITLE_SIZE * 0.72
    safeDrawText(page, item.title, {
      x: DANFE_MARGIN + DANFE_TITLE_PAD,
      y: baseline,
      size: DANFE_TITLE_SIZE,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
  }
}

function restampProductDescriptions (
  pdfDoc: PDFDocument,
  data: ReturnType<typeof parseNFeXml>,
  font: PDFFont,
) {
  if (data.produtos.length === 0) return

  const pages = pdfDoc.getPages()
  const columnWidths = [42, 130, 38, 32, 25, 20, 40, 38, 38, 32, 36, 32, 32, 28, 26]
  const scale = (595.28 - DANFE_MARGIN * 2) / columnWidths.reduce((sum, width) => sum + width, 0)
  const scaledWidths = columnWidths.map((width) => width * scale)
  const rowPositions = collectDanfeProductRows(data)
  const firstRow = rowPositions[0]
  const lastRow = rowPositions.at(-1)
  if (!firstRow || !lastRow || firstRow.page !== 0 || lastRow.page !== 0) return

  const page = pages[0]
  if (!page) return
  const fontSize = 6
  const lineHeight = 7
  const descriptions = data.produtos.map((product) => (
    wrapText(font, String(product.descricao || ''), fontSize, scaledWidths[1] - 4)
  ))
  const rowHeights = descriptions.map((lines) => Math.max(DANFE_LINE_H, lines.length * lineHeight + 3))
  const rowsHeight = rowHeights.reduce((sum, height) => sum + height, 0)
  const newAdditionalTop = firstRow.yFromTop + rowsHeight + 2
  const newContentBottom = newAdditionalTop + DANFE_TITLE_H + 55
  if (newContentBottom > DANFE_PAGE_H - DANFE_MARGIN) return

  const oldAdditionalTop = lastRow.yFromTop + DANFE_LINE_H + 2
  const oldContentBottom = oldAdditionalTop + DANFE_TITLE_H + 55
  const contentBottom = Math.max(oldContentBottom, newContentBottom)
  const { height: pageHeight } = page.getSize()
  page.drawRectangle({
    x: DANFE_MARGIN - 0.5,
    y: pageHeight - contentBottom - 0.5,
    width: 595.28 - DANFE_MARGIN * 2 + 1,
    height: contentBottom - firstRow.yFromTop + 1,
    color: rgb(1, 1, 1),
  })

  let rowTop = firstRow.yFromTop
  for (let index = 0; index < data.produtos.length; index += 1) {
    const product = data.produtos[index]
    const rowHeight = rowHeights[index]
    const rowBottom = pageHeight - rowTop - rowHeight
    const values = [
      product.codigo,
      '',
      product.ncm,
      product.origemCsosn,
      product.cfop,
      product.unidade,
      product.quantidade,
      product.valorUnitario,
      product.valorTotal,
      product.valorDesconto,
      product.bcIcms,
      product.valorIcms,
      product.valorIpi,
      product.aliqIcms,
      product.aliqIpi,
    ]

    let x = DANFE_MARGIN
    for (let column = 0; column < scaledWidths.length; column += 1) {
      const width = scaledWidths[column]
      page.drawRectangle({
        x,
        y: rowBottom,
        width,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      })
      if (column === 1) {
        let textY = rowBottom + rowHeight - fontSize - 1.5
        for (const line of descriptions[index]) {
          safeDrawText(page, line, {
            x: x + 2,
            y: textY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          })
          textY -= lineHeight
        }
      } else {
        const value = fitSingleLine(font, String(values[column] || ''), fontSize, width - 4)
        safeDrawText(page, value, {
          x: column === 0 ? x + 2 : x + width - font.widthOfTextAtSize(value, fontSize) - 2,
          y: rowBottom + (rowHeight - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        })
      }
      x += width
    }
    rowTop += rowHeight
  }

  drawAdditionalInformation(page, data, font, newAdditionalTop)
}

function fitSingleLine (font: PDFFont, value: string, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(value, size) <= maxWidth) return value
  let fitted = value
  while (fitted.length > 1 && font.widthOfTextAtSize(`${fitted}...`, size) > maxWidth) {
    fitted = fitted.slice(0, -1)
  }
  return `${fitted}...`
}

function drawAdditionalInformation (
  page: PDFPage,
  data: ReturnType<typeof parseNFeXml>,
  font: PDFFont,
  yFromTop: number,
) {
  const { width: pageWidth, height: pageHeight } = page.getSize()
  const contentWidth = pageWidth - DANFE_MARGIN * 2
  const titleBottom = pageHeight - yFromTop - DANFE_TITLE_H
  page.drawRectangle({
    x: DANFE_MARGIN,
    y: titleBottom,
    width: contentWidth,
    height: DANFE_TITLE_H,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
  })
  safeDrawText(page, 'DADOS ADICIONAIS', {
    x: DANFE_MARGIN + DANFE_TITLE_PAD,
    y: titleBottom + 3,
    size: DANFE_TITLE_SIZE,
    font,
    color: rgb(0, 0, 0),
  })

  const boxHeight = 55
  const leftWidth = contentWidth * 0.6
  const boxBottom = titleBottom - boxHeight
  for (const [x, width] of [
    [DANFE_MARGIN, leftWidth],
    [DANFE_MARGIN + leftWidth, contentWidth - leftWidth],
  ] as const) {
    page.drawRectangle({
      x,
      y: boxBottom,
      width,
      height: boxHeight,
      borderColor: rgb(0, 0, 0),
      borderWidth: 0.5,
    })
  }
  safeDrawText(page, 'INFORMACOES COMPLEMENTARES', {
    x: DANFE_MARGIN + 3,
    y: titleBottom - 8,
    size: 5,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  safeDrawText(page, 'RESERVADO AO FISCO', {
    x: DANFE_MARGIN + leftWidth + 3,
    y: titleBottom - 8,
    size: 5,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  const additionalLines = wrapText(font, String(data.informacoesComplementares || ''), 6, leftWidth - 6)
  let additionalY = titleBottom - 18
  for (const line of additionalLines.slice(0, 6)) {
    safeDrawText(page, line, {
      x: DANFE_MARGIN + 3,
      y: additionalY,
      size: 6,
      font,
      color: rgb(0, 0, 0),
    })
    additionalY -= 7
  }
}

function collectDanfeProductRows (data: ReturnType<typeof parseNFeXml>) {
  const titles = collectDanfeSectionTitles(data)
  const productsTitle = titles.find((item) => item.title === 'DADOS DOS PRODUTOS / SERVICOS')
  if (!productsTitle) return [] as Array<{ page: number, yFromTop: number }>

  const rows: Array<{ page: number, yFromTop: number }> = []
  let page = productsTitle.page
  let y = productsTitle.yFromTop + DANFE_TITLE_H + 18

  for (let index = 0; index < data.produtos.length; index += 1) {
    if (y + DANFE_LINE_H > DANFE_PAGE_H - DANFE_MARGIN - 80) {
      page += 1
      y = DANFE_MARGIN
    }
    rows.push({ page, yFromTop: y })
    y += DANFE_LINE_H
  }
  return rows
}

export async function buildNfeDanfePdf (
  auth: PortalAuthStaffSuccess,
  fiscalDocumentId: string,
): Promise<{ status: number, pdf?: Buffer, filename?: string }> {
  const { data, error } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, status, access_key, series, number, authorized_xml, submitted_xml')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .eq('model', '55')
    .maybeSingle()

  if (error) return { status: 500 }
  if (!data) return { status: 404 }
  if (data.status !== 'authorized') return { status: 409 }

  const xml = asDownloadableNfceXml(data.authorized_xml)
    || asDownloadableNfceXml(data.submitted_xml)
  if (!xml) return { status: 404 }

  try {
    let pdf = await new GerarDanfeUseCase().execute(xml)
    const logoPng = await loadOrganizationLogoPng(auth)
    try {
      pdf = await restampEmitenteBox(pdf, xml, logoPng)
    } catch (err) {
      console.error('[nfe-danfe] emitente restamp failed', err)
    }
    return {
      status: 200,
      pdf,
      filename: nfeDanfePdfFilename(
        data.access_key ? String(data.access_key) : null,
        Number(data.series) || 0,
        Number(data.number) || 0,
      ),
    }
  } catch (err) {
    console.error('[nfe-danfe] failed', err)
    return { status: 500 }
  }
}
