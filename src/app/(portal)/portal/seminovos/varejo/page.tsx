import { redirect } from 'next/navigation'
import { revendaPath } from '@/lib/revenda/revenda-paths'

type SearchParams = Promise<{ tipo?: string }>

export default async function SeminovosVarejoLegacyRedirect ({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await searchParams
  redirect(revendaPath.listagem)
}
