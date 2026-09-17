import { NextRequest, NextResponse } from 'next/server'
import { requireFiscalDocumentsReader } from '@/lib/auth/portal-api'
import {
	brazilCurrentMonthRange,
	brazilInclusiveDateRange,
	brazilPreviousMonthRange,
} from '@/lib/dashboard/brazil-day'
import { buildAccountingXmlZip } from '@/lib/fiscal/accounting-xml-export'

export const runtime = 'nodejs'
export const maxDuration = 60

function resolveQueryRange (request: NextRequest) {
	const { searchParams } = new URL(request.url)
	const period = String(searchParams.get('period') || '').trim()
	const from = String(searchParams.get('from') || '').trim()
	const to = String(searchParams.get('to') || '').trim()

	if (period === 'current_month') {
		const range = brazilCurrentMonthRange()
		return { fromDate: range.startDate, toDate: range.endDate, displayLabel: range.displayLabel }
	}
	if (period === 'previous_month' || (!period && !from && !to)) {
		const range = brazilPreviousMonthRange()
		return { fromDate: range.startDate, toDate: range.endDate, displayLabel: range.displayLabel }
	}
	if (period === 'custom' || from || to) {
		const range = brazilInclusiveDateRange(from || to, to || from)
		if (!range) return { error: 'invalid_range' as const }
		return { fromDate: range.startDate, toDate: range.endDate, displayLabel: range.displayLabel }
	}
	const range = brazilPreviousMonthRange()
	return { fromDate: range.startDate, toDate: range.endDate, displayLabel: range.displayLabel }
}

export async function GET (request: NextRequest) {
	const auth = await requireFiscalDocumentsReader()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const queryRange = resolveQueryRange(request)
	if ('error' in queryRange) {
		return NextResponse.json(
			{
				ok: false,
				error: 'invalid_range',
				message: 'Informe um período válido (datas no formato AAAA-MM-DD).',
			},
			{ status: 400 },
		)
	}

	const result = await buildAccountingXmlZip(auth, {
		fromDate: queryRange.fromDate,
		toDate: queryRange.toDate,
	})
	if (result.ok === false) {
		const status = result.error === 'no_documents'
			? 404
			: result.error === 'invalid_range'
				? 400
				: 500
		const message =
			result.error === 'no_documents'
				? `Não há NFC-e nem NF-e de produção autorizadas ou canceladas em ${result.displayLabel || queryRange.displayLabel}.`
				: result.error === 'invalid_range'
					? 'Informe um período válido (datas no formato AAAA-MM-DD).'
					: 'Não foi possível montar o arquivo de XMLs.'
		return NextResponse.json(
			{
				ok: false,
				error: result.error,
				message,
				month: result.displayLabel || queryRange.displayLabel,
			},
			{ status },
		)
	}

	return new NextResponse(new Uint8Array(result.zip), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${result.filename}"`,
			'Cache-Control': 'no-store',
			'X-Xml-Nfe-Count': String(result.nfeCount),
			'X-Xml-Nfce-Count': String(result.nfceCount),
			'X-Xml-Missing-Count': String(result.missingCount),
			'X-Xml-Month': result.displayLabel,
		},
	})
}
