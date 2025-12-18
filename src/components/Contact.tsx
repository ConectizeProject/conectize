import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Clock, MessageCircle } from "lucide-react";

const Contact = () => {
  return (
    <section id="contato" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-4">
            Contato
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Entre em{" "}
            <span className="text-gradient">Contato</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Tire suas dúvidas, solicite um orçamento ou agende a coleta do seu celular. 
            Estamos prontos para atender você!
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Contact info */}
          <div className="space-y-6">
            <div className="bg-card rounded-2xl p-6 shadow-card flex items-start gap-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">Telefone</h4>
                <a href="tel:+5531999999999" className="text-muted-foreground hover:text-primary transition-colors">
                  (31) 99999-9999
                </a>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-card flex items-start gap-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">WhatsApp</h4>
                <a 
                  href="https://wa.me/5531999999999" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  (31) 99999-9999
                </a>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-card flex items-start gap-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">E-mail</h4>
                <a href="mailto:contato@techcellbh.com.br" className="text-muted-foreground hover:text-primary transition-colors">
                  contato@techcellbh.com.br
                </a>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-card flex items-start gap-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <MapPin className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">Endereço</h4>
                <p className="text-muted-foreground">
                  Belo Horizonte - MG<br />
                  <span className="text-sm">(Atendimento em toda região metropolitana)</span>
                </p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-6 shadow-card flex items-start gap-4">
              <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h4 className="font-bold text-foreground mb-1">Horário de Atendimento</h4>
                <p className="text-muted-foreground">
                  Segunda a Sexta: 8h às 18h<br />
                  Sábado: 8h às 13h
                </p>
              </div>
            </div>
          </div>

          {/* CTA Card */}
          <div className="bg-card rounded-3xl p-8 shadow-card border border-border">
            <div className="text-center">
              <div className="w-20 h-20 gradient-primary rounded-2xl flex items-center justify-center mx-auto mb-6">
                <MessageCircle className="w-10 h-10 text-primary-foreground" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">
                Fale Conosco pelo WhatsApp
              </h3>
              <p className="text-muted-foreground mb-8">
                Atendimento rápido e personalizado. Envie uma mensagem agora mesmo 
                e receba seu orçamento em minutos!
              </p>
              
              <div className="space-y-4">
                <Button variant="whatsapp" size="xl" className="w-full" asChild>
                  <a
                    href="https://wa.me/5531999999999?text=Olá! Gostaria de um orçamento para conserto de celular."
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Chamar no WhatsApp
                  </a>
                </Button>
                
                <Button variant="outline" size="lg" className="w-full" asChild>
                  <a href="tel:+5531999999999">
                    <Phone className="w-5 h-5" />
                    Ligar Agora
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
