'use server'

import { requireAdmin } from '@/lib/auth/portal-api'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { redirect } from 'next/navigation'
import { GarantiasClient } from './GarantiasClient'

export default async function GarantiasPage () {
  const auth = await requireAdmin()
  if (auth.ok === false) {
    if (auth.status === 401) await redirectToPortalLogin()
    redirect('/portal/ordens')
  }

  const { data: templates } = await auth.supabase
    .from('warranty_templates')
    .select('id, name, body, is_active, is_default, sort_order, created_at')
    .eq('organization_id', auth.organizationId)
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <GarantiasClient initialTemplates={templates ?? []} />
  )
}
