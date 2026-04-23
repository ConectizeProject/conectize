import dynamic from 'next/dynamic'
import Hero from '@/components/Hero'

const Services = dynamic(() => import('@/components/Services'))
const Contact = dynamic(() => import('@/components/Contact'))

export default function Home () {
  return (
    <>
      <Hero />
      <Services />
      <Contact />
    </>
  )
}

