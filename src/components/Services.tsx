import { Smartphone, Battery, Monitor, Cpu, Wifi, Camera, Settings, Wrench } from "lucide-react";

const services = [
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
            Conserto de Celulares em{" "}
            <span className="text-gradient">Belo Horizonte</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Oferecemos assistência técnica completa para smartphones de todas as marcas. 
            Técnicos especializados e peças de qualidade garantida.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group bg-card rounded-2xl p-6 shadow-card hover:shadow-glow transition-all duration-300 hover:-translate-y-1 animate-fade-up"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="w-14 h-14 gradient-primary rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <service.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">{service.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {service.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;
