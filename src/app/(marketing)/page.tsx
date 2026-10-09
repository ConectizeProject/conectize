import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Hero from '@/components/Hero'
import { GeoEntitySection } from '@/components/seo/GeoEntitySection'
import { GeoServiceArea } from '@/components/seo/GeoServiceArea'
import { LocalFaq } from '@/components/seo/LocalFaq'
import { homeMetaDescription } from '@/lib/data/site-facts'
import { publicPageSeo } from '@/lib/utils/site-url'

const title = 'Conserto de iPhone e celular em BH | Conectize'
const description = homeMetaDescription

export const metadata: Metadata = {
  title,
  description,
  ...publicPageSeo('/', { title, description }),
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

