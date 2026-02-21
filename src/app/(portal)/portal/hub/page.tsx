import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { HubClient } from './HubClient'
import { HubToastClient } from './HubToastClient'

export const dynamic = 'force-dynamic'

export default async function HubPage() {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
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
  if (normalizedRole === 'staff') redirect('/portal/ordens')

  const { data: connections } = await supabase
    .from('hub_connections')
    .select('platform_id, metadata')
    .order('platform_id')

  const connectedPlatforms = new Set((connections || []).map((c: { platform_id: string }) => c.platform_id))
  const chatgptConnection = connections?.find((c: { platform_id: string }) => c.platform_id === 'chatgpt')
  const chatgptModel = (chatgptConnection?.metadata as { model?: string } | null)?.model || 'gpt-5-mini'

  return (
    <div className="space-y-6">
      <HubToastClient />
      <div>
        <h1 className="text-2xl font-bold">HUB de integrações</h1>
        <p className="text-sm text-muted-foreground">
          Conecte seu sistema com outras plataformas. Configure automações, sincronize pedidos, clientes e muito mais.
        </p>
      </div>

      <HubClient initialConnections={Array.from(connectedPlatforms)} isAdmin={me?.role === 'admin'} chatgptModel={chatgptModel} />
    </div>
  )
}
