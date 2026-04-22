import { redirect } from 'next/navigation'
import { revendaPath } from '@/lib/revenda/revenda-paths'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/**
 * Legado: `/portal/seminovos` → listagem; `?tipo=lacrados` → novos; demais query → seminovos.
 */
export default async function SeminovosLegacyRedirect ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const p = await searchParams
  const tipo = String(Array.isArray(p.tipo) ? p.tipo[0] : p.tipo || '').toLowerCase()

  const n = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (k === 'tipo') continue
    if (v === undefined) continue
    const val = Array.isArray(v) ? v[0] : v
    if (val != null && String(val) !== '') n.set(k, String(val))
  }
  const q = n.toString()

  if (tipo === 'lacrados') {
    redirect(q ? `${revendaPath.novos}?${q}` : revendaPath.novos)
  }

  const keys = Object.keys(p).filter((k) => k !== 'tipo')
  if (keys.length === 0) {
    redirect(revendaPath.listagem)
  }

  redirect(q ? `${revendaPath.seminovos}?${q}` : revendaPath.seminovos)
}
