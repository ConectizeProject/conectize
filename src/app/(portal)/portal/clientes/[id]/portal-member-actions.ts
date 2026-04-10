'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/portal-api'

export async function addCustomerPortalMemberAction (formData: FormData) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    redirect('/portal/clientes?error=sem_permissao')
  }

  const supabase = auth.supabase
  const customerId = String(formData.get('customerId') || '').trim()
  const emailRaw = String(formData.get('userEmail') || '').trim().toLowerCase()

  if (!customerId || !emailRaw) {
    redirect(`/portal/clientes/${customerId}?memberError=invalido`)
  }

  const { data: target, error: userErr } = await supabase
    .from('users')
    .select('id, email, role')
    .ilike('email', emailRaw)
    .maybeSingle()

  if (userErr || !target) {
    redirect(`/portal/clientes/${customerId}?memberError=usuario_nao_encontrado`)
  }

  if (target.role !== 'retailer') {
    redirect(`/portal/clientes/${customerId}?memberError=precisa_ser_retailer`)
  }

  const { error: insErr } = await supabase.from('customer_portal_members').insert({
    customer_id: customerId,
    user_id: target.id,
  })

  if (insErr) {
    if (insErr.code === '23505') {
      redirect(`/portal/clientes/${customerId}?memberError=ja_vinculado`)
    }
    redirect(`/portal/clientes/${customerId}?memberError=db`)
  }

  revalidatePath(`/portal/clientes/${customerId}`)
  redirect(`/portal/clientes/${customerId}?memberOk=1`)
}

export async function removeCustomerPortalMemberAction (formData: FormData) {
  const auth = await requireAdmin()
  if (!auth.ok) {
    redirect('/portal/clientes?error=sem_permissao')
  }
  const supabase = auth.supabase

  const memberId = String(formData.get('memberRowId') || '').trim()
  const customerId = String(formData.get('customerId') || '').trim()

  if (!memberId || !customerId) {
    redirect(`/portal/clientes/${customerId}?memberError=invalido`)
  }

  const { error } = await supabase
    .from('customer_portal_members')
    .delete()
    .eq('id', memberId)
    .eq('customer_id', customerId)

  if (error) {
    redirect(`/portal/clientes/${customerId}?memberError=db`)
  }

  revalidatePath(`/portal/clientes/${customerId}`)
  redirect(`/portal/clientes/${customerId}?memberRemoved=1`)
}
