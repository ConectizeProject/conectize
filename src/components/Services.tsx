import { Smartphone, Battery, Monitor, Cpu, Wifi, Camera, Settings, Wrench, LucideIcon } from "lucide-react";

interface Service {
  icon: LucideIcon | null;
  customIcon?: boolean;
  title: string;
  description: string;
  highlight?: boolean;
}

const AppleIcon = () => (
  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const services: Service[] = [
  {
    icon: null,
    customIcon: true,
    title: "Assistência Apple",
    description: "Especialistas em iPhone, iPad, MacBook e Apple Watch. Reparo com peças de qualidade.",
    highlight: true,
  },
  {
    icon: Monitor,
    title: "Troca de Tela",
    description: "Substituição de telas quebradas ou com defeito para todas as marcas de celulares.",
  },
  {
    icon: Battery,
    title: "Troca de Bateria",
    description: "Baterias originais e de alta qualidade para seu celular durar mais.",
  },
  {
    icon: Cpu,
    title: "Reparo de Placa",
    description: "Conserto de placas lógicas e componentes internos com precisão.",
  },
  {
    icon: Wifi,
    title: "Problemas de Conectividade",
    description: "Reparos em Wi-Fi, Bluetooth, antenas e conexões de rede.",
  },
  {
    icon: Camera,
    title: "Reparo de Câmera",
    description: "Troca e conserto de câmeras frontais e traseiras.",
  },
  {
    icon: Settings,
    title: "Problemas de Software",
    description: "Formatação, atualização e resolução de problemas de sistema.",
  },
  {
    icon: Smartphone,
    title: "Troca de Conector",
    description: "Substituição de conectores de carga e fones de ouvido.",
  },
  {
    icon: Wrench,
    title: "Manutenção Geral",
    description: "Limpeza, diagnóstico completo e manutenção preventiva.",
  },
];

const Services = () => {
  return (
    <section id="servicos" className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block text-primary font-semibold text-sm uppercase tracking-wider mb-4">
            Nossos Serviços
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Conserto de Celulares e{" "}
            <span className="text-gradient">Apple</span> em Belo Horizonte
          </h2>
          <p className="text-lg text-muted-foreground">
            Oferecemos assistência técnica completa para smartphones de todas as marcas, 
            com <strong className="text-foreground">especialização em produtos Apple</strong>. 
            Técnicos especializados e peças de qualidade garantida.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => {
            const IconComponent = service.icon;
            return (
              <div
                key={service.title}
                className={`group bg-card rounded-2xl p-6 shadow-card hover:shadow-glow transition-all duration-300 hover:-translate-y-1 animate-fade-up ${
                  service.highlight ? "ring-2 ring-primary lg:col-span-1 relative overflow-hidden" : ""
                }`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {service.highlight && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                    Especialidade
                  </div>
                )}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 ${
                  service.highlight ? "bg-foreground" : "gradient-primary"
                }`}>
                  {service.customIcon ? (
                    <div className="text-background"><AppleIcon /></div>
                  ) : IconComponent ? (
                    <IconComponent className="w-7 h-7 text-primary-foreground" />
                  ) : null}
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{service.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Services;
