'use client'

import Link from 'next/link'
import { Phone, MapPin, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      {/* Main nav */}
      <nav className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/logo_conectize.svg"
              alt="Conectize - Assistência Técnica"
              className="h-8 w-auto"
            />
          </Link>

          {/* Desktop menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/servicos" className="text-foreground hover:text-primary-accessible transition-colors font-medium">
              Serviços
            </Link>
            <Link href="/coleta" className="text-foreground hover:text-primary-accessible transition-colors font-medium">
              Coleta em Domicílio
            </Link>
            <Link href="/sobre" className="text-foreground hover:text-primary-accessible transition-colors font-medium">
              Sobre
            </Link>
            <Link href="/acessorios" className="text-foreground hover:text-primary-accessible transition-colors font-medium">
              Acessórios
            </Link>
            <Link href="/lojistas" className="text-foreground hover:text-primary-accessible transition-colors font-medium">
              Lojistas
            </Link>
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal">
                Área do cliente
              </Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link href="/contato">
                Fale Conosco
              </Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 text-foreground" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Menu">
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden pt-4 pb-2 animate-fade-in">
            <div className="flex flex-col gap-4">
              <Link
                href="/servicos"
                onClick={() => setIsMenuOpen(false)}
                className="text-foreground hover:text-primary-accessible transition-colors font-medium text-left py-2"
              >
                Serviços
              </Link>
              <Link
                href="/coleta"
                onClick={() => setIsMenuOpen(false)}
                className="text-foreground hover:text-primary-accessible transition-colors font-medium text-left py-2"
              >
                Coleta em Domicílio
              </Link>
              <Link
                href="/sobre"
                onClick={() => setIsMenuOpen(false)}
                className="text-foreground hover:text-primary-accessible transition-colors font-medium text-left py-2"
              >
                Sobre
              </Link>
              <Link
                href="/acessorios"
                onClick={() => setIsMenuOpen(false)}
                className="text-foreground hover:text-primary-accessible transition-colors font-medium text-left py-2"
              >
                Acessórios
              </Link>
              <Link
                href="/lojistas"
                onClick={() => setIsMenuOpen(false)}
                className="text-foreground hover:text-primary-accessible transition-colors font-medium text-left py-2"
              >
                Lojistas
              </Link>
              <Link
                href="/portal"
                onClick={() => setIsMenuOpen(false)}
                className="text-foreground hover:text-primary-accessible transition-colors font-medium text-left py-2"
              >
                Área do cliente
              </Link>
              <Button variant="hero" asChild>
                <Link href="/contato" onClick={() => setIsMenuOpen(false)}>
                  Fale Conosco
                </Link>
              </Button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

export default Header;
