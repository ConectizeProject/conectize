'use server'

import { requireAdminPage } from '@/lib/auth/portal-api'
import { GarantiasClient } from './GarantiasClient'

export default async function GarantiasPage () {
  const supabase = await requireAdminPage()

  const { data: templates } = await supabase
    .from('warranty_templates')
    .select('id, name, body, is_active, is_default, sort_order, created_at')
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (
    <GarantiasClient initialTemplates={templates ?? []} />
  )
}

