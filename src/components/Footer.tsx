import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Phone, Mail } from 'lucide-react'
import { business } from '@/lib/data/business'

const footerServices = [
  { label: 'Assistência Apple (iPhone, iPad, Mac)', href: '/assistencia-apple-bh' },
  { label: 'Troca de Tela', href: '/troca-de-tela-celular-bh' },
  { label: 'Troca de Bateria', href: '/servicos?servico=troca-de-bateria' },
  { label: 'Reparo de Placa', href: '/servicos?servico=reparo-de-placa' },
  { label: 'Coleta em Domicílio', href: '/coleta' }
]

const socialLinks = [
  { label: 'Instagram', href: 'https://www.instagram.com/conectizeoficial/' },
  { label: 'Facebook', href: 'https://www.facebook.com/ConectizeStore/' },
  { label: 'Google Maps', href: business.hasMap }
]

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4" aria-label="Ir para página inicial">
              <Image
                src="/logo_conectize.svg"
                alt="Conectize - Assistência Técnica"
                width={120}
                height={118}
                className="h-8 w-auto brightness-0 invert"
                loading="lazy"
                sizes="120px"
              />
            </Link>
            <p className="text-background/70 mb-4">
              Assistência técnica especializada em conserto de celulares e produtos Apple em Belo Horizonte. 
              Qualidade, rapidez e garantia em todos os serviços.
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              {socialLinks.map((link) => (
                <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="text-background/70 hover:text-background transition-colors">
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <p className="text-lg font-bold mb-4">Serviços</p>
            <ul className="space-y-2 text-background/70">
              {footerServices.map((service) => (
                <li key={service.href}>
                  <Link href={service.href} className="hover:text-background transition-colors">
                    {service.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="text-lg font-bold mb-4">Contato</p>
            <ul className="space-y-3 text-background/70">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <span>{business.address.streetAddress} - {business.address.neighborhood}<br />{business.address.addressLocality} - {business.address.addressRegion}, {business.address.postalCode}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href={`tel:${business.phone}`} className="hover:text-background transition-colors">
                  {business.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {business.email}
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8">
          <div className="text-center text-background/60 text-sm">
            <p>© {currentYear} Conectize - Assistência Técnica de Celular e Apple em Belo Horizonte. CNPJ {business.cnpj}. Todos os direitos reservados.</p>
            <p className="mt-2">
              Conserto de celulares Belo Horizonte | Assistência técnica iPhone BH | Coleta em domicílio | Especialista Apple
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
