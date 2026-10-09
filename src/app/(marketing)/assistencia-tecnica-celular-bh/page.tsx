import type { Metadata } from 'next'
import { GeoLandingContent } from '@/components/seo/GeoLandingContent'
import { getGeoLandingPage } from '@/lib/data/geo-landing-pages'
import { publicPageSeo } from '@/lib/utils/site-url'

const page = getGeoLandingPage('assistencia-tecnica-celular-bh')
const path = '/assistencia-tecnica-celular-bh'

export const metadata: Metadata = {
  title: page?.title,
  description: page?.description,
  keywords: page?.keywords,
  ...publicPageSeo(path, {
    title: page?.title,
    description: page?.description,
  }),
}

export default function AssistenciaTecnicaCelularBhPage () {
  if (!page) return null
  return <GeoLandingContent page={page} />
}
