import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/utils/site-url'

export default function robots (): MetadataRoute.Robots {
  const siteUrl = getSiteUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/_next/',
          '/portal',
          '/os/',
          '/.well-known/apple-app-site-association',
          '/apple-app-site-association',
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}


