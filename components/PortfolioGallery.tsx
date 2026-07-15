"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { portfolioImages } from "@/lib/data";

export function PortfolioGallery() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section
      id="work"
      style={{
        padding: "8rem 2rem",
        maxWidth: "72rem",
        margin: "0 auto",
      }}
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "0.7rem",
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          color: "var(--color-ash-dim)",
          marginBottom: "4rem",
        }}
      >
        Artworks
      </motion.h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {portfolioImages.map((img, i) => (
          <motion.div
            key={img.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: i * 0.05 }}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{
              position: "relative",
              aspectRatio: "1",
              overflow: "hidden",
              borderRadius: "4px",
              backgroundColor: "var(--color-navy-800)",
              cursor: "default",
            }}
          >
            {/* Image */}
            <img
              src={img.src}
              alt={img.title}
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: hoveredIndex === i ? "blur(0px)" : "blur(12px)",
                WebkitFilter: hoveredIndex === i ? "blur(0px)" : "blur(12px)",
                transform:
                  hoveredIndex === i ? "scale(1.05)" : "scale(1)",
                transition:
                  "filter 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />

            {/* Frost overlay - subtle glass when blurred, clears on hover */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  hoveredIndex === i
                    ? "transparent"
                    : "linear-gradient(135deg, rgba(13,33,55,0.3) 0%, rgba(8,14,26,0.4) 100%)",
                backdropFilter:
                  hoveredIndex === i ? "blur(0px)" : "blur(4px)",
                WebkitBackdropFilter:
                  hoveredIndex === i ? "blur(0px)" : "blur(4px)",
                transition: "all 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                pointerEvents: "none",
              }}
            >
              {/* Subtle noise overlay */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.3'/%3E%3C/svg%3E\")",
                  backgroundSize: "128px 128px",
                  opacity: hoveredIndex === i ? 0.02 : 0.08,
                  transition: "opacity 0.5s",
                  mixBlendMode: "overlay",
                }}
              />
            </div>

            {/* Label - visible on hover */}
            <motion.div
              initial={false}
              animate={{
                opacity: hoveredIndex === i ? 1 : 0,
                y: hoveredIndex === i ? 0 : 8,
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: "1.25rem",
                background:
                  "linear-gradient(transparent, rgba(8,14,26,0.85))",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: "var(--color-blue-ice)",
                  display: "block",
                  marginBottom: "0.2rem",
                }}
              >
                {img.category}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-serif-cn)",
                  fontSize: "0.9rem",
                  color: "var(--color-bone)",
                }}
              >
                {img.title}
              </span>
            </motion.div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
