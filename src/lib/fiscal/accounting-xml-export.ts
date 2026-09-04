import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { brazilPreviousMonthRange } from '@/lib/dashboard/brazil-day'
import {
	accountingXmlFolder,
	accountingXmlZipFilename,
	formatMissingAccountingXmlLine,
	missingAccountingXmlFile,
	uniqueZipEntryName,
} from '@/lib/fiscal/accounting-xml'
import { canDownloadFiscalXml } from '@/lib/fiscal/document-status'
import {
	asDownloadableNfceXml,
	fiscalXmlFilename,
} from '@/lib/fiscal/sefaz-consulta'
import { buildZip, type ZipFile } from '@/lib/utils/zip'

type AuthCtx = PortalAuthStaffSuccess

type FiscalXmlRow = {
	model: unknown
	status: unknown
	access_key: unknown
	series: unknown
	number: unknown
	authorized_xml: unknown
	submitted_xml: unknown
}

const PAGE_SIZE = 500

function asModel(value: unknown): '55' | '65' {
	return value === '55' ? '55' : '65'
}

export type AccountingXmlZipOk = {
	ok: true
	zip: Buffer
	filename: string
	monthLabel: string
	displayLabel: string
	nfceCount: number
	nfeCount: number
	missingCount: number
}

export type AccountingXmlZipErr = {
	ok: false
	error: 'no_documents' | 'db_error'
	displayLabel: string
}

export async function buildAccountingXmlZip(
	auth: AuthCtx,
	now = new Date(),
): Promise<AccountingXmlZipOk | AccountingXmlZipErr> {
	const range = brazilPreviousMonthRange(now)
	const rows: FiscalXmlRow[] = []
	let from = 0

	while (true) {
		const { data, error } = await auth.supabase
			.from('fiscal_documents')
			.select(
				'model, status, access_key, series, number, authorized_xml, submitted_xml',
			)
			.eq('organization_id', auth.organizationId)
			.eq('environment', 'producao')
			.in('model', ['55', '65'])
			.in('status', ['authorized', 'canceled'])
			.gte('authorized_at', range.startIso)
			.lte('authorized_at', range.endIso)
			.order('authorized_at', { ascending: true })
			.range(from, from + PAGE_SIZE - 1)

		if (error) {
			return { ok: false, error: 'db_error', displayLabel: range.displayLabel }
		}
		const batch = (data ?? []) as FiscalXmlRow[]
		rows.push(...batch)
		if (batch.length < PAGE_SIZE) break
		from += PAGE_SIZE
	}

	if (rows.length === 0) {
		return {
			ok: false,
			error: 'no_documents',
			displayLabel: range.displayLabel,
		}
	}

	const usedNames = new Set<string>()
	const files: ZipFile[] = []
	const missing: string[] = []
	let nfceCount = 0
	let nfeCount = 0

	for (const row of rows) {
		if (!canDownloadFiscalXml(row.status)) continue
		const model = asModel(row.model)
		const series = Number(row.series) || 0
		const number = Number(row.number) || 0
		const accessKey = row.access_key ? String(row.access_key) : null
		const xml =
			asDownloadableNfceXml(row.authorized_xml) ||
			asDownloadableNfceXml(row.submitted_xml)

		if (!xml) {
			missing.push(
				formatMissingAccountingXmlLine({
					model,
					series,
					number,
					accessKey,
				}),
			)
			continue
		}

		const folder = accountingXmlFolder(model)
		const filename = fiscalXmlFilename(model, accessKey, series, number)
		const entryName = uniqueZipEntryName(usedNames, `${folder}/${filename}`)
		files.push({ name: entryName, content: Buffer.from(xml, 'utf8') })
		if (model === '55') nfeCount += 1
		else nfceCount += 1
	}

	if (missing.length > 0) {
		files.push({
			name: 'notas-sem-xml.txt',
			content: Buffer.from(
				missingAccountingXmlFile(range.displayLabel, missing),
				'utf8',
			),
		})
	}

	if (nfceCount === 0 && nfeCount === 0 && missing.length === 0) {
		return {
			ok: false,
			error: 'no_documents',
			displayLabel: range.displayLabel,
		}
	}

	return {
		ok: true,
		zip: buildZip(files),
		filename: accountingXmlZipFilename(range.label),
		monthLabel: range.label,
		displayLabel: range.displayLabel,
		nfceCount,
		nfeCount,
		missingCount: missing.length,
	}
}
