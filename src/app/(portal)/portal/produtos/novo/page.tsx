import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { getPortalAuth } from '@/lib/supabase/server'
import { ProductForm } from '../ProductForm'
import {
  createProduct,
  replaceProductCompatibleDeviceModels,
} from '@/lib/products/service'
import { parseCompatibleModelIdsFromForm } from '@/lib/products/parse-compatible-model-ids'

export const dynamic = 'force-dynamic'

export default async function NovoProdutoPage () {
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()
  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')
  if (normalizedRole !== 'staff' && normalizedRole !== 'admin') redirect('/portal/minhas-ordens')

  async function handleCreate (formData: FormData) {
    'use server'

    const name = String(formData.get('name') || '').trim()
    const sku = String(formData.get('sku') || '').trim() || null
    const barcode = String(formData.get('barcode') || '').trim() || null
    const description = String(formData.get('description') || '').trim() || null
    const salePrice = Number(String(formData.get('salePrice') || '').replace(',', '.')) || 0
    const costPrice = Number(String(formData.get('costPrice') || '').replace(',', '.')) || 0
    const isActive = formData.get('isActive') === 'on'
    const initialStock = Number(String(formData.get('initialStock') || '0').replace(',', '.')) || 0
    const pricingTagRaw = String(formData.get('pricingTagId') || '').trim()
    const pricingTagId = pricingTagRaw || null
    const partsFamilyRaw = String(formData.get('partsFamily') || '').trim()
    const partsFamily = partsFamilyRaw || null
    const compatibleIds = parseCompatibleModelIdsFromForm(formData.get('compatibleModelIds'))

    const created = await createProduct({
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

    if (!created.ok || !('product' in created)) {
      redirect('/portal/produtos?tab=gestao')
    }

    const linkRes = await replaceProductCompatibleDeviceModels(created.product.id, compatibleIds)
    if (!linkRes.ok) {
      redirect(`/portal/produtos/${created.product.id}/editar`)
    }

    if (initialStock > 0) {
      const { addStockMovement } = await import('@/lib/products/service')
      await addStockMovement(created.product.id, {
        type: 'entry',
        quantity: initialStock,
        unitValueCents: created.product.costPriceCents ?? created.product.salePriceCents ?? 0,
        source: 'system',
      })
    }

    redirect('/portal/produtos?tab=gestao')
  }

  return (
    <ProductForm
      mode="create"
      action={handleCreate}
    />
  )
}

