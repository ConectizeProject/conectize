import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function PortalHomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user

  if (!user) {
    redirect('/portal/login?redirectTo=/portal')
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

