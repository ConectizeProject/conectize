import { Button } from "@/components/ui/button";
import { Truck, Clock, MapPin, CheckCircle, ArrowRight } from "lucide-react";

const benefits = [
  "Buscamos seu celular em casa ou no trabalho",
  "Sem custo adicional na região de BH",
  "Diagnóstico e orçamento rápido",
  "Devolução no mesmo local após o conserto",
  "Acompanhamento em tempo real do serviço",
];

const PickupService = () => {
  return (
    <section id="coleta" className="py-20 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div>
            <span className="inline-block text-accent font-semibold text-sm uppercase tracking-wider mb-4">
              Exclusivo
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Coleta em{" "}
              <span className="text-gradient">Domicílio</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Não precisa sair de casa! Nossa equipe vai até você em toda Belo Horizonte 
              para buscar e devolver seu celular consertado. Comodidade e praticidade 
              para seu dia a dia.
            </p>

            <ul className="space-y-4 mb-8">
              {benefits.map((benefit, index) => (
                <li
                  key={benefit}
                  className="flex items-start gap-3 animate-fade-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <CheckCircle className="w-6 h-6 text-accent flex-shrink-0 mt-0.5" />
                  <span className="text-foreground">{benefit}</span>
                </li>
              ))}
            </ul>

            <Button variant="hero" size="lg" asChild>
              <a
                href="https://wa.me/5531999999999?text=Olá! Gostaria de agendar a coleta do meu celular em domicílio."
                target="_blank"
                rel="noopener noreferrer"
              >
                Agendar Coleta Grátis
                <ArrowRight className="w-5 h-5" />
              </a>
            </Button>
          </div>

          {/* Visual */}
          <div className="relative">
            <div className="bg-card rounded-3xl p-8 shadow-card">
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">1</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Agende a Coleta</p>
                    <p className="text-sm text-muted-foreground">
                      Entre em contato pelo WhatsApp e escolha o melhor horário
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">2</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Buscamos seu Celular</p>
                    <p className="text-sm text-muted-foreground">
                      Nossa equipe vai até você em qualquer região de BH
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex items-start gap-4 p-4 bg-secondary/50 rounded-2xl">
                  <div className="w-12 h-12 gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold">3</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Conserto Rápido</p>
                    <p className="text-sm text-muted-foreground">
                      Diagnóstico, orçamento e reparo com qualidade
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex items-start gap-4 p-4 bg-accent/10 rounded-2xl border-2 border-accent/30">
                  <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-accent-foreground font-bold">4</span>
                  </div>
                  <div>
                    <p className="font-bold text-foreground mb-1">Entrega em Domicílio</p>
                    <p className="text-sm text-muted-foreground">
                      Devolvemos seu celular funcionando no mesmo local
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -top-4 -left-4 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Frete Grátis
            </div>
            <div className="absolute -bottom-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Até 24h
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PickupService;
