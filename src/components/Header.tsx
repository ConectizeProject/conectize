import { Phone, MapPin, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth" });
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      {/* Top bar */}
      <div className="bg-primary text-primary-foreground py-2">
        <div className="container mx-auto px-4 flex flex-wrap justify-center md:justify-between items-center gap-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>Belo Horizonte - MG</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            <a href="tel:+5531999999999" className="hover:underline">
              (31) 99999-9999
            </a>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <a href="#" className="text-2xl font-bold text-gradient">
            TechCell BH
          </a>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => scrollToSection("servicos")}
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              Serviços
            </button>
            <button
              onClick={() => scrollToSection("coleta")}
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              Coleta em Domicílio
            </button>
            <button
              onClick={() => scrollToSection("sobre")}
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              Sobre
            </button>
            <Button
              variant="hero"
              size="sm"
              onClick={() => scrollToSection("contato")}
            >
              Fale Conosco
            </Button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden pt-4 pb-2 animate-fade-in">
            <div className="flex flex-col gap-4">
              <button
                onClick={() => scrollToSection("servicos")}
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-left py-2"
              >
                Serviços
              </button>
              <button
                onClick={() => scrollToSection("coleta")}
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-left py-2"
              >
                Coleta em Domicílio
              </button>
              <button
                onClick={() => scrollToSection("sobre")}
                className="text-foreground/80 hover:text-primary transition-colors font-medium text-left py-2"
              >
                Sobre
              </button>
              <Button
                variant="hero"
                onClick={() => scrollToSection("contato")}
              >
                Fale Conosco
              </Button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
