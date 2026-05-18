import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { normalizePortalRole } from '@/lib/auth/portal-api'
import { WhatsappInboxClient } from './WhatsappInboxClient'

export const dynamic = 'force-dynamic'

export default async function WhatsappInboxPage () {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) await redirectToPortalLogin()

  const { data: appUser } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const role = normalizePortalRole(appUser?.role)
  if (role === 'user') redirect('/portal/minhas-ordens')
  if (role === 'retailer') redirect('/portal/tabela-de-precos')

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conversas vindas da Cloud API e da Evolution API (mensagens só com texto). Mensagens da IA ficam como
          pendentes até você marcar como atendidas.
        </p>
      </div>
      <WhatsappInboxClient />
    </div>
  )
}
