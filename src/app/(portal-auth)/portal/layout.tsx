import Header from '@/components/Header'
import Footer from '@/components/Footer'

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default function PortalAuthLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}

