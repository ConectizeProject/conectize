import { redirect } from 'next/navigation'
import { getPortalAuth } from '@/lib/supabase/server'
import { AparelhosClient } from './AparelhosClient'

export const dynamic = 'force-dynamic'

export default async function AparelhosPage() {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  return <AparelhosClient />
}

