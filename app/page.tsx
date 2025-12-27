import Header from '@/components/Header'
import Hero from '@/components/Hero'
import Services from '@/components/Services'
import PickupService from '@/components/PickupService'
import About from '@/components/About'
import Testimonials from '@/components/Testimonials'
import Contact from '@/components/Contact'
import Footer from '@/components/Footer'

export default function Home () {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Services />
        <PickupService />
        <About />
        <Testimonials />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}



