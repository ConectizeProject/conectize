const STATUSPAGE_SUMMARY_URL = 'https://status.supabase.com/api/v2/summary.json'
const STATUS_PAGE_HREF = 'https://status.supabase.com'

type StatuspageSummaryJson = {
  page?: { url?: string }
  status?: {
    indicator?: string
    description?: string
  }
  incidents?: Array<{
    name?: string
    status?: string
  }>
}

export type SupabasePlatformStatusBanner = {
  severity: 'minor' | 'major' | 'critical' | 'maintenance'
  headline: string
  detail: string | null
  statusPageHref: string
}

function mapIndicatorToSeverity (indicator: string): SupabasePlatformStatusBanner['severity'] | null {
  if (indicator === 'none') return null
  if (indicator === 'minor') return 'minor'
  if (indicator === 'major') return 'major'
  if (indicator === 'critical') return 'critical'
  if (indicator === 'maintenance') return 'maintenance'
  return 'minor'
}

/**
 * Status agregado da plataforma Supabase (status.supabase.com / Statuspage).
 * Retorna null quando tudo operacional ou quando a verificação falha (evita alarme falso).
 */
export async function getSupabasePlatformStatus (): Promise<SupabasePlatformStatusBanner | null> {
  try {
    const res = await fetch(STATUSPAGE_SUMMARY_URL, {
      next: { revalidate: 120 },
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null

    const data = (await res.json()) as StatuspageSummaryJson
    const indicator = data.status?.indicator ?? 'none'
    const severity = mapIndicatorToSeverity(indicator)
    if (!severity) return null

    const headline =
      (typeof data.status?.description === 'string' && data.status.description.trim()) ||
      'Indisponibilidade ou degradação nos serviços Supabase'

    const activeIncidents =
      data.incidents?.filter((i) => i.status && i.status !== 'resolved') ?? []
    const firstName = activeIncidents.find((i) => typeof i.name === 'string' && i.name.trim())?.name
    const detail = firstName?.trim() ?? null

    return {
      severity,
      headline,
      detail,
      statusPageHref: typeof data.page?.url === 'string' ? data.page.url : STATUS_PAGE_HREF,
    }
  } catch {
    return null
  }
}
