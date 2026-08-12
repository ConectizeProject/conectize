import { business, buildWhatsAppUrl, getFaqPageJsonLd, type FaqItem } from '@/lib/data/business'

const localFaqItems: FaqItem[] = [
  {
    q: 'A Conectize é assistência técnica de celular em Belo Horizonte?',
    a: `Sim. A Conectize fica em ${business.address.neighborhood}, Belo Horizonte, e atende conserto de celulares Android e produtos Apple, com orçamento por WhatsApp e coleta em domicílio em BH.`
  },
  {
    q: 'Quais marcas e aparelhos a Conectize atende?',
    a: 'Atendemos iPhone, iPad, MacBook, Apple Watch e celulares Android das principais marcas, incluindo Samsung, Xiaomi, Motorola e LG.'
  },
  {
    q: 'Vocês fazem coleta em domicílio?',
    a: 'Sim. A Conectize oferece coleta e entrega em domicílio para Belo Horizonte. O cliente pode calcular a coleta pelo CEP e combinar o atendimento pelo WhatsApp.'
  },
  {
    q: 'Qual é o horário de funcionamento?',
    a: `O atendimento acontece de ${business.openingHours[0].label.toLowerCase()}, das ${business.openingHours[0].display}, e aos sábados, das ${business.openingHours[1].display}.`
  },
  {
    q: 'Os serviços têm garantia?',
    a: 'Sim. Os serviços realizados pela Conectize têm garantia de 6 meses, conforme o tipo de reparo e peça instalada.'
  },
  {
    q: 'Como pedir orçamento?',
    a: `Você pode chamar no WhatsApp ${business.phoneDisplay}, informar o modelo do aparelho e descrever o defeito para receber orientação e orçamento.`
  }
]

export function LocalFaq () {
  return (
    <section className="py-20 bg-background" aria-labelledby="local-faq-title">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(getFaqPageJsonLd(localFaqItems)) }}
      />

      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <span className="inline-block text-primary-accessible font-semibold text-sm uppercase tracking-wider mb-4">
            Perguntas frequentes
          </span>
          <h2 id="local-faq-title" className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Dúvidas sobre assistência técnica em BH
          </h2>
          <p className="text-muted-foreground text-lg">
            Respostas diretas para quem procura conserto de celular, Apple e coleta em Belo Horizonte.
          </p>
        </div>

        <div className="max-w-4xl mx-auto divide-y divide-border rounded-2xl border border-border bg-card">
          {localFaqItems.map((item) => (
            <details key={item.q} className="group p-6">
              <summary className="cursor-pointer list-none font-bold text-foreground flex items-center justify-between gap-4">
                {item.q}
                <span className="text-primary-accessible group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-muted-foreground mt-4 leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="text-center mt-10">
          <a
            href={buildWhatsAppUrl('Olá! Gostaria de tirar uma dúvida sobre assistência técnica.')}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-accessible font-semibold hover:underline"
          >
            Tirar dúvida pelo WhatsApp →
          </a>
        </div>
      </div>
    </section>
  )
}
