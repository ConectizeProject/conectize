import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { buildAccountingXmlZip } from '@/lib/fiscal/accounting-xml-export'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET() {
	const auth = await requireStaffOrAdmin()
	if (auth.ok === false) {
		return NextResponse.json(
			{ ok: false, error: auth.error },
			{ status: auth.status },
		)
	}

	const result = await buildAccountingXmlZip(auth)
	if (result.ok === false) {
		const status = result.error === 'no_documents' ? 404 : 500
		const message =
			result.error === 'no_documents'
				? `Não há NFC-e nem NF-e de produção autorizadas ou canceladas em ${result.displayLabel}.`
				: 'Não foi possível montar o arquivo de XMLs.'
		return NextResponse.json(
			{
				ok: false,
				error: result.error,
				message,
				month: result.displayLabel,
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
