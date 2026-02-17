import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Mariana Costa",
    role: "Designer",
    avatar: "MC",
    rating: 5,
    text: "Troquei a tela do meu iPhone 13 e ficou perfeito! Atendimento super rápido, fizeram a coleta no meu trabalho e entregaram no mesmo dia. Recomendo demais!",
    service: "Troca de Tela - iPhone 13",
  },
  {
    name: "Carlos Eduardo",
    role: "Empresário",
    avatar: "CE",
    rating: 5,
    text: "Levei meu MacBook Pro que não ligava mais. Os técnicos identificaram o problema rapidamente e resolveram em 2 dias. Preço justo e trabalho de qualidade.",
    service: "Reparo de Placa - MacBook Pro",
  },
  {
    name: "Ana Paula Silva",
    role: "Advogada",
    avatar: "AP",
    rating: 5,
    text: "A bateria do meu celular durava apenas 2 horas. Trocaram a bateria e agora dura o dia todo! Equipe muito profissional e atenciosa.",
    service: "Troca de Bateria - Samsung S22",
  },
  {
    name: "Roberto Mendes",
    role: "Médico",
    avatar: "RM",
    rating: 5,
    text: "Excelente serviço de coleta em domicílio! Não precisei me deslocar, vieram buscar meu iPad e devolveram consertado. Muito prático!",
    service: "Troca de Tela - iPad Air",
  },
  {
    name: "Juliana Ferreira",
    role: "Professora",
    avatar: "JF",
    rating: 5,
    text: "Meu iPhone 12 estava com problema na câmera. Ficou como novo! O técnico ainda me deu dicas para conservar melhor o aparelho.",
    service: "Reparo de Câmera - iPhone 12",
  },
  {
    name: "Fernando Alves",
    role: "Engenheiro",
    avatar: "FA",
    rating: 5,
    text: "Já é a terceira vez que uso os serviços da Conectize. Sempre muito profissionais e com garantia. São especialistas Apple de verdade!",
    service: "Manutenção Geral - iPhone 14 Pro",
  },
];

const Testimonials = () => {
  return (
    <section id="depoimentos" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block text-primary-accessible font-semibold text-sm uppercase tracking-wider mb-4">
            Depoimentos
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            O que nossos{" "}
            <span className="text-gradient">clientes</span> dizem
          </h2>
          <p className="text-lg text-muted-foreground">
            Mais de 5.000 clientes satisfeitos em Belo Horizonte. Veja o que eles têm a dizer sobre nossos serviços.
          </p>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mb-12">
          <div className="flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-primary-accessible text-primary-accessible" />
              ))}
            </div>
            <span className="font-bold text-foreground">4.9/5</span>
            <span className="text-muted-foreground">no Google</span>
          </div>
          <div className="text-muted-foreground">
            <span className="font-bold text-foreground">+5.000</span> clientes atendidos
          </div>
          <div className="text-muted-foreground">
            <span className="font-bold text-foreground">98%</span> de satisfação
          </div>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="bg-card rounded-2xl p-6 shadow-card hover:shadow-glow transition-all duration-300 animate-fade-up relative"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/20" />
              
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-primary-accessible text-primary-accessible" />
                ))}
              </div>

              {/* Text */}
              <p className="text-muted-foreground mb-6 leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Service tag */}
              <div className="mb-4">
                <span className="inline-block bg-primary/15 text-primary-accessible text-xs font-medium px-3 py-1 rounded-full">
                  {testimonial.service}
                </span>
              </div>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-bold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <a
            href="https://www.google.com/maps/place/R.+Padre+Rolim,+620"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
          >
            <Star className="w-5 h-5" />
            Ver todas as avaliações no Google
          </a>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
