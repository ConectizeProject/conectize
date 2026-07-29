import type { Metadata } from 'next'
import { GeoLandingContent } from '@/components/seo/GeoLandingContent'
import { business } from '@/lib/data/business'
import { getGeoLandingPage } from '@/lib/data/geo-landing-pages'

const page = getGeoLandingPage('assistencia-apple-bh')

export const metadata: Metadata = {
  title: page?.title,
  description: page?.description,
  keywords: page?.keywords,
  alternates: {
    canonical: `${business.siteUrl}/assistencia-apple-bh`
  }
}

export default function AssistenciaAppleBhPage () {
  if (!page) return null
  return <GeoLandingContent page={page} />
}
