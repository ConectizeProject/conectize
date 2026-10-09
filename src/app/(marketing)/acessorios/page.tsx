import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'
import { publicPageSeo } from '@/lib/utils/site-url'

const destination = '/loja/acessorios'
const title = 'Capinhas, películas e carregadores em BH | Conectize'
const description = 'Capinhas, películas, carregadores e cabos para iPhone e Android, com pronta entrega na loja da Conectize em Santa Efigênia, Belo Horizonte (BH).'

export const metadata: Metadata = {
  title,
  description,
  robots: { index: false, follow: true },
  ...publicPageSeo(destination, { title, description }),
}

export default function AcessoriosPage () {
  permanentRedirect(destination)
}
