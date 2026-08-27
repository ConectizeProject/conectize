import 'server-only'
import sharp from 'sharp'
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { GerarDanfeUseCase } from '@brasil-fiscal/nfe'
import { parseNFeXml } from '@brasil-fiscal/nfe/dist/infra/danfe/xml-parser'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { asDownloadableNfceXml } from '@/lib/fiscal/sefaz-consulta'
import { getSiteUrl } from '@/lib/utils/site-url'

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
  const trimmed = logoUrl.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('/')) return `${getSiteUrl()}${trimmed}`
  return `${getSiteUrl()}/${trimmed}`
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
