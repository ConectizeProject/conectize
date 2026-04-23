import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function MarketingLayout ({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <a
        href="#conteudo-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Pular para o conteúdo principal
      </a>
      <main id="conteudo-principal" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
