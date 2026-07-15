"use client";

import { motion, useMotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { recentAlbums } from "@/lib/data";

const SCROLL_SPEED = 0.5; // px per frame

export function RecentlyPlayed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tooltip, setTooltip] = useState<{ name: string; artist: string } | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const scrollX = useMotionValue(0);
  const rafRef = useRef<number>(0);

  // Double the albums array for seamless infinite scroll
 const allAlbums = [...recentAlbums, ...recentAlbums];

  const animate = () => {
    if (!isHovered) {
      scrollX.set(scrollX.get() - SCROLL_SPEED);
    }
    rafRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setTooltip(null);
  };

  return (
    <section
      id="listening"
      style={{
        padding: "6rem 0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          padding: "0 2rem",
          marginBottom: "2.5rem",
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
          }}
        >
          Recently Listened
        </motion.h2>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.2 }}
        ref={containerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: "flex",
          gap: "1.25rem",
          width: "max-content",
          padding: "0.5rem 2rem",
          x: scrollX,
        }}
      >
        {allAlbums.map((album, i) => (
          <div
            key={`${album.name}-${i}`}
            onMouseEnter={(e) => {
              setTooltip({ name: album.name, artist: album.artist });
              const rect = e.currentTarget.getBoundingClientRect();
              setTooltipPos({
                x: rect.left + rect.width / 2,
                y: rect.top - 10,
              });
            }}
            onMouseMove={(e) => {
              if (tooltip?.name === album.name) {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltipPos({
                  x: rect.left + rect.width / 2,
                  y: rect.top - 10,
                });
              }
            }}
            onMouseLeave={() => {
              if (tooltip?.name === album.name) {
                setTooltip(null);
              }
            }}
            style={{
              flexShrink: 0,
              width: "140px",
              aspectRatio: "1",
              borderRadius: "4px",
              overflow: "hidden",
              position: "relative",
              cursor: "default",
            }}
          >
            <img
              src={album.src}
              alt={album.name}
              draggable={false}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                transition: "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
              }}
            />
          </div>
        ))}
      </motion.div>

      {/* Floating tooltip */}
      {tooltip && (
        <motion.div
          initial={{ opacity: 0, y: 4, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-50%) translateY(-100%)",
            background: "rgba(13,33,55,0.9)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(168,176,188,0.12)",
            borderRadius: "6px",
            padding: "0.6rem 1rem",
            pointerEvents: "none",
            zIndex: 1000,
            minWidth: "120px",
            textAlign: "center" as const,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              fontWeight: 500,
              color: "var(--color-bone)",
              marginBottom: "0.15rem",
              whiteSpace: "nowrap",
            }}
          >
            {tooltip.name}
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.65rem",
              color: "var(--color-ash-dim)",
              whiteSpace: "nowrap",
            }}
          >
            {tooltip.artist}
          </div>
        </motion.div>
      )}
    </section>
  );
}
