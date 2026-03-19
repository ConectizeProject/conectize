import { NextResponse } from 'next/server'
import { getPortalAuth } from '@/lib/supabase/server'
import { getProductById } from '@/lib/products/service'
import { updateProductAndSyncBling } from '@/lib/products/update-product-with-bling'

type Params = Promise<{ id: string }>

function calculateEAN13Checksum (code12: string) {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const digit = Number(code12[i])
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

function generateEAN13 () {
  const prefix = '761'
  const randomNineDigits = Math.floor(100000000 + Math.random() * 900000000)
  const baseCode = `${prefix}${randomNineDigits.toString()}`
  const checksum = calculateEAN13Checksum(baseCode)
  return `${baseCode}${checksum}`
}

export async function POST (
  _request: Request,
  { params }: { params: Params },
) {
  const { id } = await params
  const { user, role } = await getPortalAuth()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'not_authenticated' }, { status: 401 })
  }

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'user' || !normalizedRole) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 })
  }

  const productRes = await getProductById(id)
  if (!productRes.ok || !('product' in productRes)) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 })
  }

  const product = productRes.product
  if (product.barcode) {
    return NextResponse.json({ ok: true, product, syncedToBling: false })
  }

  const nextBarcode = generateEAN13()

  const updateRes = await updateProductAndSyncBling(id, { barcode: nextBarcode })
  if (!updateRes.ok) {
    const error = 'error' in updateRes ? updateRes.error : 'db_error'
    const message = 'message' in updateRes ? updateRes.message : undefined
    return NextResponse.json({ ok: false, error, message }, { status: 400 })
  }

  const shouldSyncToBling = Boolean(updateRes.product.blingId)
  return NextResponse.json({
    ok: true,
    product: updateRes.product,
    syncedToBling: false,
    shouldSyncToBling,
  })
}

