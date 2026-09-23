import { NextResponse } from 'next/server'
import { requireStaffOrAdmin } from '@/lib/auth/portal-api'
import { repairAllVariationAttributesForOrganization } from '@/lib/products/service'

/**
 * Repara atributos/nomes de variações de toda a organização:
 * infere chaves no pai (ex.: Modelo) e normaliza filhos para
 * «Nome do pai Modelo:valor».
 */
export async function POST () {
  const auth = await requireStaffOrAdmin()
  if (auth.ok === false) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const result = await repairAllVariationAttributesForOrganization()
  if (result.ok === false) {
    const status = result.error === 'not_authenticated' ? 401 : 500
    return NextResponse.json({ ok: false, error: result.error }, { status })
  }

  return NextResponse.json({
    ok: true,
    parentsRepaired: result.parentsRepaired,
    childrenUpdated: result.childrenUpdated,
  })
}
