import 'server-only'
import type { PortalAuthStaffSuccess } from '@/lib/auth/portal-api'
import { canDownloadFiscalXml } from '@/lib/fiscal/document-status'
import {
  asDownloadableNfceXml,
  nfceXmlFilename,
} from '@/lib/fiscal/sefaz-consulta'

export async function loadNfceXmlDownload (
  auth: PortalAuthStaffSuccess,
  fiscalDocumentId: string,
): Promise<{ status: number, xml?: string, filename?: string }> {
  const { data, error } = await auth.supabase
    .from('fiscal_documents')
    .select('id, model, status, access_key, series, number, authorized_xml, submitted_xml')
    .eq('organization_id', auth.organizationId)
    .eq('id', fiscalDocumentId)
    .eq('model', '65')
    .maybeSingle()

  if (error) return { status: 500 }
  if (!data) return { status: 404 }
  if (!canDownloadFiscalXml(data.status)) return { status: 409 }

  const xml = asDownloadableNfceXml(data.authorized_xml)
    || asDownloadableNfceXml(data.submitted_xml)
  if (!xml) return { status: 404 }

  return {
    status: 200,
    xml,
    filename: nfceXmlFilename(data.access_key, Number(data.series) || 0, Number(data.number) || 0),
  }
}
