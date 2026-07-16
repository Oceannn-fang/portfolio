import { Navbar } from "@/components/Navbar";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Work } from "@/components/Work";
import { PortfolioGallery } from "@/components/PortfolioGallery";
import { RecentlyPlayed } from "@/components/RecentlyPlayed";
import { Contact } from "@/components/Contact";

export default function Page() {
  return (
    <>
      <GrainOverlay />
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
        <RecentlyPlayed />
        <div className="section-divider" />
        <Contact />
      </main>
    </>
  );
}