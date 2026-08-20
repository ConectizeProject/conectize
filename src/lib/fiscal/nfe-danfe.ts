import 'server-only'
import { GerarDanfeUseCase } from '@brasil-fiscal/nfe'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { asDownloadableNfceXml } from '@/lib/fiscal/sefaz-consulta'

export async function buildNfeDanfePdf (
  auth: PortalAuthStaffSuccess,
  fiscalDocumentId: string,
): Promise<{ status: number, pdf?: Buffer }> {
  const { data, error } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, status, authorized_xml, submitted_xml')
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
    const pdf = await new GerarDanfeUseCase().execute(xml)
    return { status: 200, pdf }
  } catch (err) {
    console.error('[nfe-danfe] failed', err)
    return { status: 500 }
  }
}
