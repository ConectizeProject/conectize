'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient, getAuthUser } from '@/lib/supabase/server'
import { GarantiasClient } from './GarantiasClient'

async function requireAdmin () {
  const supabase = await createSupabaseServerClient()
  const { user } = await getAuthUser()
  if (!user) redirect('/portal/login')

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') redirect('/portal/ordens')

  return { supabase, user }
}

export default async function GarantiasPage () {
  const { supabase } = await requireAdmin()

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

