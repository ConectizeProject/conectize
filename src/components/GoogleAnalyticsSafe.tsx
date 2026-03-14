'use client'

import dynamic from 'next/dynamic'
import { GoogleAnalyticsBoundary } from '@/components/GoogleAnalyticsBoundary'

const GoogleAnalytics = dynamic(
  () => import('@/components/GoogleAnalytics').then((m) => ({ default: m.GoogleAnalytics })),
  { ssr: false }
)

export function GoogleAnalyticsSafe () {
  return (
    <GoogleAnalyticsBoundary>
      <GoogleAnalytics />
    </GoogleAnalyticsBoundary>
  )
}
