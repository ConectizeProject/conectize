/**
 * Cria composição de estoque virtual para kits *TMDADPTMKB*
 * (3X..., 4X..., TMDADPTMKB-04X, etc.) apontando para o produto base TMDADPTMKB.
 *
 * Uso: node --env-file=.env.local scripts/seed-tmdadptmkb-virtual-stock.mjs [--apply]
 */
import { createClient } from '@supabase/supabase-js'

const BASE_SKU = 'TMDADPTMKB'
const apply = process.argv.includes('--apply')

function parseMultiplier (skuRaw) {
  const sku = String(skuRaw || '').trim().toUpperCase().replace(/\s+/g, '')
  const base = BASE_SKU
  if (!sku || sku === base || !sku.includes(base)) return null
  const prefix = sku.match(new RegExp(`^(\\d+)X${base}$`))
  if (prefix) return Math.max(1, Number(prefix[1]) || 1)
  const suffix = sku.match(new RegExp(`^${base}-(\\d+)X$`))
  if (suffix) return Math.max(1, Number(suffix[1]) || 1)
  return null
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: products, error } = await supabase
  .from('products')
  .select('id, organization_id, sku, name, is_active, cost_price_cents')
  .ilike('sku', `%${BASE_SKU}%`)
  .order('sku', { ascending: true })

if (error) {
  console.error('products query failed:', error.message)
  process.exit(1)
}

const rows = products ?? []
const byOrg = new Map()
for (const row of rows) {
  const orgId = String(row.organization_id || '')
  if (!orgId) continue
  const list = byOrg.get(orgId) ?? []
  list.push(row)
  byOrg.set(orgId, list)
}

console.log(apply ? 'MODO APPLY' : 'DRY-RUN (use --apply)')
console.log(`Orgs com SKUs ${BASE_SKU}: ${byOrg.size}`)

let planned = 0
let upserted = 0

for (const [orgId, orgProducts] of byOrg) {
  const bases = orgProducts.filter((p) => String(p.sku || '').trim().toUpperCase() === BASE_SKU)
  // Preferir o cadastro com custo 5,80; senão o ativo; senão o primeiro.
  const base = [...bases].sort((a, b) => {
    const costA = Number(a.cost_price_cents) || 0
    const costB = Number(b.cost_price_cents) || 0
    if (costA === 580 && costB !== 580) return -1
    if (costB === 580 && costA !== 580) return 1
    if (a.is_active && !b.is_active) return -1
    if (b.is_active && !a.is_active) return 1
    return 0
  })[0]

  if (!base) {
    console.log(`org ${orgId}: sem produto base ${BASE_SKU}`)
    continue
  }

  console.log(`\norg ${orgId}`)
  console.log(`  base=${base.sku} id=${base.id} custo=${Number(base.cost_price_cents) || 0}`)

  for (const product of orgProducts) {
    const multiplier = parseMultiplier(product.sku)
    if (multiplier == null) continue
    if (product.id === base.id) continue
    planned += 1
    console.log(`  kit ${product.sku} -> ${multiplier}x ${BASE_SKU}`)

    if (!apply) continue

    const { error: upsertError } = await supabase
      .from('product_stock_components')
      .upsert({
        organization_id: orgId,
        product_id: product.id,
        component_product_id: base.id,
        quantity_per_unit: multiplier,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'product_id,component_product_id',
      })

    if (upsertError) {
      console.error(`  falhou ${product.sku}:`, upsertError.message)
      continue
    }
    upserted += 1
  }
}

console.log('')
console.log(`Kits planejados: ${planned}`)
if (apply) console.log(`Composições gravadas: ${upserted}`)
else console.log('Nada gravado. Rode com --apply após a migration.')
