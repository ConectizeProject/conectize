import { Award, Users, ThumbsUp, Zap } from "lucide-react";

const stats = [
  { icon: Users, value: "5.000+", label: "Clientes Atendidos" },
  { icon: ThumbsUp, value: "98%", label: "Satisfação" },
  { icon: Award, value: "15+", label: "Anos de Experiência" },
  { icon: Zap, value: "24h", label: "Tempo Médio de Reparo" },
];

const About = () => {
  return (
    <section id="sobre" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-6">
            {stats.map((stat, index) => (
              <div
                key={stat.label}
                className="bg-card rounded-2xl p-6 shadow-card text-center animate-scale-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-7 h-7 text-primary-foreground" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-gradient mb-2">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Content */}
          <div>
            <span className="inline-block text-primary-accessible font-semibold text-sm uppercase tracking-wider mb-4">
              Sobre Nós
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Especialistas em{" "}
              <span className="text-gradient">Conserto de Celulares</span>
            </h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Somos uma assistência técnica especializada em conserto de celulares 
                com cede em <strong className="text-foreground">Belo Horizonte</strong>. 
                Com mais de 15 anos de experiência no mercado, nos destacamos pela qualidade 
                dos nossos serviços e atendimento personalizado.
              </p>
              <p>
                Nossa equipe é formada por técnicos certificados e constantemente atualizados 
                sobre as últimas tecnologias do mercado. Trabalhamos com peças de 
                alta qualidade e oferecemos garantia de 6 meses em todos os serviços realizados.
              </p>
              <p>
                Atendemos todas as marcas de smartphones: iPhone, Samsung, Motorola, Xiaomi, 
                LG e muitas outras. Seja troca de tela, bateria, reparo de placa ou 
                qualquer outro problema, temos a solução para você.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
