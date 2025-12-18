import { Button } from "@/components/ui/button";
import { Smartphone, Shield, Clock, ArrowRight } from "lucide-react";

const Hero = () => {
  const scrollToContact = () => {
    document.getElementById("contato")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen gradient-hero pt-32 pb-20 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 right-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-6 animate-fade-up">
              <Shield className="w-4 h-4" />
              Assistência Técnica Especializada
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Assistência Técnica de{" "}
              <span className="text-gradient">Celular</span> em Belo Horizonte
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto lg:mx-0 animate-fade-up" style={{ animationDelay: "0.2s" }}>
              Conserto de celulares com qualidade e rapidez. Oferecemos{" "}
              <strong className="text-foreground">coleta em domicílio</strong> para sua comodidade em toda Belo Horizonte.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <Button variant="hero" size="xl" onClick={scrollToContact}>
                Solicitar Orçamento
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button variant="whatsapp" size="xl" asChild>
                <a
                  href="https://wa.me/5531999999999?text=Olá! Gostaria de um orçamento para conserto de celular."
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 justify-center lg:justify-start mt-12 animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Atendimento Rápido</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium">Garantia em Todos Serviços</span>
              </div>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative flex justify-center animate-float">
            <div className="relative">
              <div className="absolute inset-0 gradient-primary rounded-3xl blur-2xl opacity-30 scale-105" />
              <div className="relative bg-card rounded-3xl p-8 shadow-card">
                <Smartphone className="w-48 h-48 md:w-64 md:h-64 text-primary" strokeWidth={1} />
                <div className="absolute -top-4 -right-4 bg-accent text-accent-foreground px-4 py-2 rounded-xl font-bold text-sm shadow-lg">
                  Coleta Grátis!
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
