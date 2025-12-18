import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import PickupService from "@/components/PickupService";
import About from "@/components/About";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://techcellbh.com.br",
    name: "TechCell BH - Assistência Técnica de Celular",
    image: "https://techcellbh.com.br/logo.png",
    description: "Assistência técnica especializada em conserto de celulares em Belo Horizonte. Troca de tela, bateria, reparo de placa e coleta em domicílio.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Belo Horizonte",
      addressRegion: "MG",
      addressCountry: "BR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -19.9167,
      longitude: -43.9345,
    },
    url: "https://techcellbh.com.br",
    telephone: "+5531999999999",
    priceRange: "$$",
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "08:00",
        closes: "18:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "13:00",
      },
    ],
    sameAs: [],
    areaServed: {
      "@type": "City",
      name: "Belo Horizonte",
    },
    serviceType: [
      "Assistência técnica de celular",
      "Conserto de celulares",
      "Troca de tela de celular",
      "Troca de bateria de celular",
      "Coleta em domicílio",
    ],
  };

  return (
    <>
      <Helmet>
        <title>Assistência Técnica de Celular em Belo Horizonte | TechCell BH</title>
        <meta
          name="description"
          content="Conserto de celulares em Belo Horizonte com coleta em domicílio. Troca de tela, bateria, reparo de placa. Atendimento rápido e garantia em todos os serviços. Ligue agora!"
        />
        <meta
          name="keywords"
          content="assistencia tecnica de celular em belo horizonte, concerto de celulares belo horizonte, conserto de celular bh, troca de tela celular bh, coleta em domicilio celular, assistencia tecnica iphone bh, assistencia tecnica samsung bh"
        />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="TechCell BH" />
        <link rel="canonical" href="https://techcellbh.com.br" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Assistência Técnica de Celular em Belo Horizonte | TechCell BH" />
        <meta property="og:description" content="Conserto de celulares em Belo Horizonte com coleta em domicílio. Atendimento rápido e garantia!" />
        <meta property="og:url" content="https://techcellbh.com.br" />
        <meta property="og:site_name" content="TechCell BH" />
        <meta property="og:locale" content="pt_BR" />
        
        {/* Geo tags */}
        <meta name="geo.region" content="BR-MG" />
        <meta name="geo.placename" content="Belo Horizonte" />
        <meta name="geo.position" content="-19.9167;-43.9345" />
        <meta name="ICBM" content="-19.9167, -43.9345" />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen">
        <Header />
        <main>
          <Hero />
          <Services />
          <PickupService />
          <About />
          <Contact />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
