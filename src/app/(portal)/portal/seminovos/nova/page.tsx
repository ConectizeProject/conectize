import { redirect } from 'next/navigation'
import { getPortalAuth } from '@/lib/supabase/server'
import { SeminovosFormClient } from '../SeminovosFormClient'

export default async function SeminovosNovaPage() {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  return <SeminovosFormClient isCreate />
}
