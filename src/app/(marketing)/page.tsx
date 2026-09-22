import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Hero from '@/components/Hero'
import { GeoEntitySection } from '@/components/seo/GeoEntitySection'
import { GeoServiceArea } from '@/components/seo/GeoServiceArea'
import { LocalFaq } from '@/components/seo/LocalFaq'
import { getSiteUrl } from '@/lib/utils/site-url'

export const metadata: Metadata = {
  alternates: {
    canonical: getSiteUrl(),
  },
}

const Services = dynamic(() => import('@/components/Services'))
const Contact = dynamic(() => import('@/components/Contact'))

export default function Home () {
  return (
    <>
      <Hero />
      <Services />
      <GeoEntitySection />
      <GeoServiceArea />
      <LocalFaq />
      <Contact />
    </>
  )
}

