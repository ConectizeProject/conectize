import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import PickupService from "@/components/PickupService";
import About from "@/components/About";
import Testimonials from "@/components/Testimonials";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

const Index = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": "https://conectize.com.br",
    name: "Conectize - Assistência Técnica de Celular e Apple",
    image: "https://conectize.com.br/logo.png",
    description: "Assistência técnica especializada em conserto de celulares e produtos Apple (iPhone, iPad, MacBook) em Belo Horizonte. Troca de tela, bateria, reparo de placa e coleta em domicílio.",
    address: {
      "@type": "PostalAddress",
      streetAddress: "R. Padre Rolim, 620",
      addressLocality: "Belo Horizonte",
      addressRegion: "MG",
      postalCode: "30130-094",
      addressCountry: "BR",
      neighborhood: "Santa Efigênia",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -19.9297,
      longitude: -43.9325,
    },
    url: "https://conectize.com.br",
    telephone: "+5531986140889",
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
      "Assistência técnica Apple",
      "Conserto de iPhone",
      "Conserto de iPad",
      "Conserto de MacBook",
      "Troca de tela de celular",
      "Troca de bateria de celular",
      "Coleta em domicílio",
    ],
  };

  return (
    <>
      <Helmet>
        <title>Assistência Técnica de Celular e Apple em Belo Horizonte | Conectize</title>
        <meta
          name="description"
          content="Conserto de celulares e produtos Apple (iPhone, iPad, MacBook) em Belo Horizonte com coleta em domicílio. Especialistas Apple. Troca de tela, bateria, reparo de placa. Atendimento rápido e garantia!"
        />
        <meta
          name="keywords"
          content="assistencia tecnica de celular em belo horizonte, concerto de celulares belo horizonte, conserto de celular bh, assistencia tecnica iphone bh, conserto iphone belo horizonte, assistencia apple bh, conserto macbook bh, troca de tela celular bh, coleta em domicilio celular"
        />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Conectize" />
        <link rel="canonical" href="https://conectize.com.br" />
        
        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Assistência Técnica de Celular e Apple em Belo Horizonte | Conectize" />
        <meta property="og:description" content="Conserto de celulares e produtos Apple em Belo Horizonte com coleta em domicílio. Especialistas Apple. Atendimento rápido e garantia!" />
        <meta property="og:url" content="https://conectize.com.br" />
        <meta property="og:site_name" content="Conectize" />
        <meta property="og:locale" content="pt_BR" />
        
        {/* Geo tags */}
        <meta name="geo.region" content="BR-MG" />
        <meta name="geo.placename" content="Belo Horizonte, Santa Efigênia" />
        <meta name="geo.position" content="-19.9297;-43.9325" />
        <meta name="ICBM" content="-19.9297, -43.9325" />
        
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
          <Testimonials />
          <Contact />
        </main>
        <Footer />
      </div>
    </>
  );
};

export default Index;
