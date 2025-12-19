import { MapPin, Phone, Mail } from "lucide-react";
const Footer = () => {
  const currentYear = new Date().getFullYear();
  return <footer className="bg-foreground text-background py-12">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold mb-4">Conectize</h3>
            <p className="text-background/70 mb-4">
              Assistência técnica especializada em conserto de celulares em Belo Horizonte. 
              Qualidade, rapidez e garantia em todos os serviços.
            </p>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-lg font-bold mb-4">Serviços</h4>
            <ul className="space-y-2 text-background/70">
              <li>Troca de Tela</li>
              <li>Troca de Bateria</li>
              <li>Reparo de Placa</li>
              <li>Coleta em Domicílio</li>
              <li>Manutenção Geral</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-lg font-bold mb-4">Contato</h4>
            <ul className="space-y-3 text-background/70">
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Belo Horizonte - MG
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                (31) 99999-9999
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                contato@techcellbh.com.br
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/20 pt-8">
          <div className="text-center text-background/60 text-sm">
            <p>© {currentYear} TechCell BH - Assistência Técnica de Celular em Belo Horizonte. Todos os direitos reservados.</p>
            <p className="mt-2">
              Conserto de celulares Belo Horizonte | Assistência técnica celular BH | Coleta em domicílio
            </p>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;