import { getPortalAuth } from '@/lib/supabase/server'
import { PdvClient } from './PdvClient'

export default async function PdvPage () {
  const { fullName, user } = await getPortalAuth()
  const sellerName = (fullName || user?.email || '').trim() || 'Vendedor'

  return <PdvClient sellerName={sellerName} />
}
