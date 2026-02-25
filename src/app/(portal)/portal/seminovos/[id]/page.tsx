import { redirect } from 'next/navigation'
import { getPortalAuth } from '@/lib/supabase/server'
import { SeminovosFormClient } from '../SeminovosFormClient'

type Props = {
  params: Promise<{ id: string }>
}

export default async function SeminovosEditPage({ params }: Props) {
  const { user, role } = await getPortalAuth()
  if (!user) redirect('/portal/login')

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal')

  const { id } = await params
  if (!id) redirect('/portal/seminovos')

  return <SeminovosFormClient deviceId={id} isCreate={false} />
}
