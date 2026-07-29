import type { Metadata } from 'next'
import { GeoLandingContent } from '@/components/seo/GeoLandingContent'
import { business } from '@/lib/data/business'
import { getGeoLandingPage } from '@/lib/data/geo-landing-pages'

const page = getGeoLandingPage('conserto-iphone-bh')

export const metadata: Metadata = {
  title: page?.title,
  description: page?.description,
  keywords: page?.keywords,
  alternates: {
    canonical: `${business.siteUrl}/conserto-iphone-bh`
  }
}

export default function ConsertoIphoneBhPage () {
  if (!page) return null
  return <GeoLandingContent page={page} />
}
