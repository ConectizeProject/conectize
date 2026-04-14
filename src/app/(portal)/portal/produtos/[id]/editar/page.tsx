import { notFound, redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { ProductForm } from '../../ProductForm'
import {
  getProductById,
  replaceProductCompatibleDeviceModels,
} from '@/lib/products/service'
import { updateProductAndSyncBling } from '@/lib/products/update-product-with-bling'
import { parseCompatibleModelIdsFromForm } from '@/lib/products/parse-compatible-model-ids'

export const dynamic = 'force-dynamic'

type Params = Promise<{ id: string }>

export default async function EditarProdutoPage ({ params }: { params: Params }) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal/minhas-ordens')

  const current = await getProductById(id)
  if (!current.ok || !('product' in current)) notFound()

  const supabase = await createSupabaseServerClient()
  const { data: pcRows } = await supabase
    .from('product_compatible_device_models')
    .select(`
      device_model_id,
      device_models (
        id,
        model,
        device_types (
          name,
          device_brands ( name )
        )
      )
    `)
    .eq('product_id', id)

  const initialCompatibleModels: { id: string; label: string }[] = []
  for (const row of pcRows || []) {
    const r = row as {
      device_model_id?: string
      device_models?: unknown
    }
    const mid = r.device_model_id ? String(r.device_model_id) : ''
    const dmRaw = r.device_models
    const dm = Array.isArray(dmRaw) ? dmRaw[0] : dmRaw
    if (!mid || !dm || typeof dm !== 'object') continue
    const dmo = dm as { model?: string | null; device_types?: unknown }
    const dtRaw = dmo.device_types
    const dt = Array.isArray(dtRaw) ? dtRaw[0] : dtRaw
    const dto = dt && typeof dt === 'object' ? dt as { name?: string | null; device_brands?: unknown } : null
    const brRaw = dto?.device_brands
    const br = Array.isArray(brRaw) ? brRaw[0] : brRaw
    const bro = br && typeof br === 'object' ? br as { name?: string | null } : null
    const parts = [bro?.name, dto?.name, dmo.model].filter(Boolean).map((x) => String(x).trim())
    initialCompatibleModels.push({
      id: mid,
      label: parts.join(' · ') || mid,
    })
  }

  async function handleUpdate (formData: FormData) {
    'use server'

    const name = String(formData.get('name') || '').trim()
    const sku = String(formData.get('sku') || '').trim() || null
    const barcode = String(formData.get('barcode') || '').trim() || null
    const description = String(formData.get('description') || '').trim() || null
    const salePrice = Number(String(formData.get('salePrice') || '').replace(',', '.')) || 0
    const costPrice = Number(String(formData.get('costPrice') || '').replace(',', '.')) || 0
    const isActive = formData.get('isActive') === 'on'
    const pricingTagRaw = String(formData.get('pricingTagId') || '').trim()
    const pricingTagId = pricingTagRaw || null
    const partsFamilyRaw = String(formData.get('partsFamily') || '').trim()
    const partsFamily = partsFamilyRaw || null
    const compatibleIds = parseCompatibleModelIdsFromForm(formData.get('compatibleModelIds'))

    await updateProductAndSyncBling(id, {
      name,
      sku,
      barcode,
      description,
      salePriceCents: salePrice > 0 ? Math.round(salePrice * 100) : null,
      costPriceCents: costPrice > 0 ? Math.round(costPrice * 100) : null,
      isActive,
      pricingTagId,
      partsFamily,
    })

    await replaceProductCompatibleDeviceModels(id, compatibleIds)

    redirect('/portal/produtos?tab=gestao')
  }

  return (
    <ProductForm
      mode="edit"
      product={current.product}
      initialCompatibleModels={initialCompatibleModels}
      action={handleUpdate}
    />
  )
}

