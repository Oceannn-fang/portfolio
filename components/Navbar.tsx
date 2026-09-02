"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { useState, useEffect } from "react";

const links = [
  { label: "About", href: "#about" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "Contact", href: "#contact" },
];

export function Navbar() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 80, damping: 20 });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: scrolled ? "0.75rem 2rem" : "1.5rem 2rem",
          transition: "padding 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
          backdropFilter: scrolled ? "blur(12px) saturate(1.2)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px) saturate(1.2)" : "none",
          backgroundColor: scrolled ? "rgba(255,255,255,0.82)" : "transparent",
        }}
      >
        <a
          href="#"
          style={{
            fontFamily: "var(--font-serif-en)",
            fontSize: "1.25rem",
            letterSpacing: "0.02em",
            color: "var(--color-ivory)",
            textDecoration: "none",
          }}
        >
          F.
        </a>
        <div
          style={{
            display: "flex",
            gap: "1.75rem",
            fontFamily: "var(--font-sans)",
            fontSize: "0.75rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                color: "var(--color-dim)",
                textDecoration: "none",
                position: "relative",
                paddingBottom: "2px",
                transition: "color 0.3s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-ivory)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-dim)")}
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
      <motion.div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: "1.5px",
          transformOrigin: "0%",
          scaleX,
          background:
            "linear-gradient(90deg, var(--color-ivory), var(--color-faint))",
          zIndex: 101,
        }}
      />
    </>
  );
}