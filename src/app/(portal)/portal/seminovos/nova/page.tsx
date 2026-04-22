import { redirect } from 'next/navigation'
import { revendaPath } from '@/lib/revenda/revenda-paths'

type SearchParams = Promise<{ tipo?: string }>

export default async function SeminovosNovaLegacyRedirect ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const params = await searchParams
  const isLacrado = String(params?.tipo || '').toLowerCase() === 'lacrados'
  redirect(isLacrado ? revendaPath.novaNovo : revendaPath.nova)
}
