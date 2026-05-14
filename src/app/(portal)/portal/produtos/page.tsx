import { redirect } from 'next/navigation'
import { redirectToPortalLogin } from '@/lib/auth/redirect-to-portal-login'
import { loadStaffPricingTagsTabData } from '@/lib/pricing/staff-pricing-tags-tab-data'
import { createSupabaseServerClient, getPortalAuth } from '@/lib/supabase/server'
import { ProdutosGestaoTab } from './ProdutosGestaoTab'
import { ProdutosStaffTabsNav, type ProdutosStaffTabId } from './ProdutosStaffTabsNav'
import { StaffPrecosTabClient } from './StaffPrecosTabClient'
import { PricingTagsStaffTab } from './PricingTagsStaffTab'
import { ProdutosGestaoActionsProvider } from './ProdutosGestaoActionsContext'
import { ProdutosGestaoHeaderActions } from './ProdutosGestaoHeaderActions'

export const dynamic = 'force-dynamic'

type SearchParams = Promise<{
  q?: string
  loaded?: string
  kind?: string
  sku?: string
  barcode?: string
  tab?: string
  edit?: string
  newVariationOf?: string
}>

function parseStaffTab (raw: string | undefined): ProdutosStaffTabId {
  const t = String(raw || '').trim().toLowerCase()
  if (t === 'precos' || t === 'tags') return t
  return 'gestao'
}

export default async function ProdutosPage ({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams
  const { user, role } = await getPortalAuth()
  if (!user) await redirectToPortalLogin()

  const normalizedRole = role === 'customer' ? 'user' : role
  if (normalizedRole === 'retailer') redirect('/portal/tabela-de-precos')
  if (normalizedRole === 'user' || !normalizedRole) redirect('/portal/minhas-ordens')
  if (
    normalizedRole !== 'staff' &&
    normalizedRole !== 'admin' &&
    normalizedRole !== 'platform_admin'
  ) redirect('/portal/minhas-ordens')

  const tab = parseStaffTab(sp.tab)
  const initialEditProductId = String(sp.edit || '').trim() || undefined
  const initialCreateVariationParentId = String(sp.newVariationOf || '').trim() || undefined

  const pricingTagsTabData =
    tab === 'tags' ? await loadStaffPricingTagsTabData(await createSupabaseServerClient()) : null

  return (
    <ProdutosGestaoActionsProvider>
      <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Produtos e serviços</h1>
          </div>
          {tab === 'gestao' ? <ProdutosGestaoHeaderActions /> : null}
        </div>

        <ProdutosStaffTabsNav activeTab={tab} />

        {tab === 'gestao' ? (
        <ProdutosGestaoTab
          q={String(sp.q || '')}
          loaded={String(sp.loaded || '')}
          kind={String(sp.kind || '')}
          sku={String(sp.sku || '')}
          barcode={String(sp.barcode || '')}
          initialEditProductId={initialEditProductId}
          initialCreateVariationParentId={initialCreateVariationParentId}
        />
        ) : null}
        {tab === 'precos' ? <StaffPrecosTabClient /> : null}
        {tab === 'tags' && pricingTagsTabData ? (
          <PricingTagsStaffTab
            initialPricingTags={pricingTagsTabData.pricingTags}
            initialRetailers={pricingTagsTabData.retailers}
            initialOverrides={pricingTagsTabData.overrides}
          />
        ) : null}
      </div>
    </ProdutosGestaoActionsProvider>
  )
}
