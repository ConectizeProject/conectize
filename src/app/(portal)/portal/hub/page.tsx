import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { HubClient } from './HubClient'
import { HubToastClient } from './HubToastClient'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const supabase = await createSupabaseServerClient()
  const { data: authData } = await supabase.auth.getUser()
  const user = authData?.user
  if (!user) redirect('/portal/login')

  const { data: appUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const me = appUser
  const role = appUser?.role || 'user'
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user') redirect('/portal/minhas-ordens')

  const { data: connections } = await supabase
    .from('hub_connections')
    .select('platform_id')
    .order('platform_id')

  const connectedPlatforms = new Set((connections || []).map((c: { platform_id: string }) => c.platform_id))

  return (
    <div className="space-y-6">
      <HubToastClient />
      <div>
        <h1 className="text-2xl font-bold">HUB de integrações</h1>
        <p className="text-sm text-muted-foreground">
          Conecte seu sistema com outras plataformas. Configure automações, sincronize pedidos, clientes e muito mais.
        </p>
      </div>

      <HubClient initialConnections={Array.from(connectedPlatforms)} isAdmin={me?.role === 'admin'} />
    </div>
  )
}
