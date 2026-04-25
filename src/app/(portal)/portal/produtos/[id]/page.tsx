import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function ProdutoDetalhePage ({ params }: { params: Params }) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    redirect('/portal/minhas-ordens')
  }

  redirect(`/portal/produtos?tab=gestao&edit=${encodeURIComponent(id)}`)
}

