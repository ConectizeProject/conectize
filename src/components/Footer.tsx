import Link from 'next/link'
import { MapPin, Phone, Mail } from 'lucide-react'

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <img
                src="/logo_conectize.svg"
                alt="Conectize - Assistência Técnica"
                className="h-8 w-auto brightness-0 invert"
              />
            </Link>
            <p className="text-background/70 mb-4">
              Assistência técnica especializada em conserto de celulares e produtos Apple em Belo Horizonte. 
              Qualidade, rapidez e garantia em todos os serviços.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-bold mb-4">Serviços</h4>
            <ul className="space-y-2 text-background/70">
              <li>Assistência Apple (iPhone, iPad, Mac)</li>
              <li>Troca de Tela</li>
              <li>Troca de Bateria</li>
              <li>Reparo de Placa</li>
              <li>Coleta em Domicílio</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold mb-4">Contato</h4>
            <ul className="space-y-3 text-background/70">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-1 flex-shrink-0" />
                <span>R. Padre Rolim, 620 - Santa Efigênia<br />Belo Horizonte - MG, 30130-094</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <a href="tel:+5531986140889" className="hover:text-background transition-colors">
                  (31) 9 8614-0889
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                contato@conectize.com.br
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8">
          <div className="text-center text-background/60 text-sm">
            <p>© {currentYear} Conectize - Assistência Técnica de Celular e Apple em Belo Horizonte. Todos os direitos reservados.</p>
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
