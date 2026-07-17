import { Navbar } from "@/components/Navbar";
import Grainient from "@/components/Grainient";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Work } from "@/components/Work";
import { PortfolioGallery } from "@/components/PortfolioGallery";
import { Listening } from "@/components/Listening";
import CircularGallery from "@/components/CircularGallery";
import { Contact } from "@/components/Contact";

export default function Page() {
  return (
    <>
      <Grainient
        color1="#fcfcfc"
        color2="#f9f9f9"
        color3="#f5f5f0"
        timeSpeed={0.02}
        warpStrength={0.15}
        warpFrequency={1.5}
        warpSpeed={0.3}
        warpAmplitude={8.0}
        rotationAmount={30.0}
        noiseScale={4.0}
        grainAmount={0.6}
        grainScale={32.0}
        grainAnimated={true}
        grainSpeed={0.05}
        grainDensity={0.97}
        contrast={0.9}
        saturation={0.05}
        zoom={1.0}
        centerX={0.0}
        centerY={0.0}
        blendSoftness={0.1}
      />

      <Navbar />
      <main>
        <Hero />
        <div className="section-divider" />
        <About />
        <div className="section-divider" />
        <Work />
        <div className="section-divider" />
        <PortfolioGallery />
        <div className="section-divider" />
        <Listening />
        <div className="section-divider" />
        <CircularGallery />
        <div className="section-divider" />
        <Contact />
      </main>
    </>
  );
}