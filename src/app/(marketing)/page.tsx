import type { Metadata } from 'next'
import dynamic from 'next/dynamic'
import Hero from '@/components/Hero'
import { GeoEntitySection } from '@/components/seo/GeoEntitySection'
import { GeoServiceArea } from '@/components/seo/GeoServiceArea'
import { LocalFaq } from '@/components/seo/LocalFaq'
import { publicPageSeo } from '@/lib/utils/site-url'

const title = 'Conserto de iPhone e celular em BH | Conectize'
const description = 'Conserto de iPhone, iPad e celular em BH, com garantia e coleta em domicílio. Troca de tela, bateria e placa. Orçamento rápido pelo WhatsApp.'

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

