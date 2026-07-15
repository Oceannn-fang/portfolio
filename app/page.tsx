import { Navbar } from "@/components/Navbar";
import { GrainOverlay } from "@/components/GrainOverlay";
import { CursorFollower } from "@/components/CursorFollower";
import { Hero } from "@/components/Hero";
import { About } from "@/components/About";
import { Work } from "@/components/Work";
import { Contact } from "@/components/Contact";

export default function Page() {
  return (
    <>
      <GrainOverlay />
      <CursorFollower />
      <Navbar />
      <main>
        <Hero />
        <div className="section-divider" />
        <About />
        <div className="section-divider" />
        <Work />
        <div className="section-divider" />
        <Contact />
      </main>
    </>
  );
}
