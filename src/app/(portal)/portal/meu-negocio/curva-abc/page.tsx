import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { loadAbcSkus } from '@/lib/reports/load-abc-skus'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { CurvaAbcClient } from './CurvaAbcClient'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Curva ABC · Portal',
}

export default async function CurvaAbcPage () {
  const { user, role, organizationId } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()
  if (role !== 'admin' && role !== 'platform_admin') redirect('/portal/ordens')

  const supabase = await createSupabaseServerClient()
  const skus = organizationId ? await loadAbcSkus(supabase, organizationId) : []

  return <CurvaAbcClient skus={skus} />
}
