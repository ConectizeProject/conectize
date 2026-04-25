import { createSupabaseServerClient } from '@/lib/supabase/server'

export type StaffPricingTagRow = {
  id: string
  name: string
  margin_bps: number | null
  min_suggested_sale_cents: number | null
}

export type StaffPricingTagsRetailerRow = {
  id: string
  email: string | null
  full_name: string | null
}

export type StaffPricingTagOverrideRow = {
  id: string
  pricing_tag_id: string
  retailer_user_id: string
  margin_bps: number | null
  min_suggested_sale_cents: number | null
}

export type StaffPricingTagsTabData = {
  pricingTags: StaffPricingTagRow[]
  retailers: StaffPricingTagsRetailerRow[]
  overrides: StaffPricingTagOverrideRow[]
}

type PortalSupabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

/**
 * Mesmas consultas das rotas GET /api/portal/staff/pricing-tags,
 * /retailers e /pricing-tag-overrides — para hidratar a aba no servidor.
 */
export async function loadStaffPricingTagsTabData (
  supabase: PortalSupabase
): Promise<StaffPricingTagsTabData> {
  const [tagsRes, retailersRes, overridesRes] = await Promise.all([
    supabase
      .from('pricing_tags')
      .select('id, name, margin_bps, min_suggested_sale_cents')
      .order('name', { ascending: true }),
    supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('role', 'retailer')
      .order('full_name', { ascending: true, nullsFirst: false }),
    supabase
      .from('pricing_tag_retailer_overrides')
      .select('id, pricing_tag_id, retailer_user_id, margin_bps, min_suggested_sale_cents')
      .order('updated_at', { ascending: false }),
  ])

  if (tagsRes.error) {
    console.error('[loadStaffPricingTagsTabData] pricing_tags', tagsRes.error)
  }
  if (retailersRes.error) {
    console.error('[loadStaffPricingTagsTabData] retailers', retailersRes.error)
  }
  if (overridesRes.error) {
    console.error('[loadStaffPricingTagsTabData] overrides', overridesRes.error)
  }

  const pricingTags = (!tagsRes.error && tagsRes.data
    ? tagsRes.data
    : []) as StaffPricingTagRow[]

  const retailersRaw = (!retailersRes.error && retailersRes.data
    ? retailersRes.data
    : []) as Array<{ id: string; email: string | null; full_name: string | null; role: string }>

  const retailers: StaffPricingTagsRetailerRow[] = retailersRaw.map((r) => ({
    id: r.id,
    email: r.email,
    full_name: r.full_name,
  }))

  const overrides = (!overridesRes.error && overridesRes.data
    ? overridesRes.data
    : []) as StaffPricingTagOverrideRow[]

  return { pricingTags, retailers, overrides }
}
