import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PortalHomePage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) {
    await redirectToPortalLogin()
  }

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = appUser?.role || 'user'
  const isBasicUser = role === 'user' || role === 'customer' || !role

  if (isBasicUser) redirect('/portal/minhas-ordens')
  redirect('/portal/dashboard')
}

