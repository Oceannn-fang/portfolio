"use client";

import { useState } from "react";
import { motion } from "motion/react";
import OrbitImages from "@/components/OrbitImages";
import { recentAlbums } from "@/lib/data";

const albumImages = recentAlbums.map((a) => a.src);

export function Listening() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const hoveredAlbum = hoveredIndex !== null ? recentAlbums[hoveredIndex] : null;

  return (
    <section
      id="listening"
      style={{
        padding: "6rem 2rem 8rem",
        position: "relative",
      }}
    >
      <div
        style={{
          maxWidth: "72rem",
          margin: "0 auto",
          marginBottom: "3rem",
          textAlign: "center",
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

      <div style={{ maxWidth: "64rem", margin: "0 auto", position: "relative" }}>
        <OrbitImages
          images={albumImages}
          shape="ellipse"
          radiusX={520}
          radiusY={130}
          rotation={-6}
          duration={35}
          itemSize={72}
          responsive={true}
          paused={hoveredIndex !== null}
          onItemHover={setHoveredIndex as (index: number | null) => void}
          centerContent={
            <div style={{ textAlign: "center", pointerEvents: "none" }}>
              {hoveredAlbum ? (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    padding: "0.75rem 1.25rem",
                    borderRadius: "6px",
                    background: "rgba(245,242,237,0.9)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid rgba(168,176,188,0.1)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.8rem",
                      fontWeight: 500,
                      color: "var(--color-bone)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hoveredAlbum.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.65rem",
                      color: "var(--color-ash-dim)",
                      marginTop: "0.15rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {hoveredAlbum.artist}
                  </div>
                </motion.div>
              ) : (
                <div
                  style={{
                    fontFamily: "var(--font-serif-cn)",
                    fontSize: "0.75rem",
                    color: "var(--color-ash)",
                    letterSpacing: "0.06em",
                    opacity: 0.6,
                  }}
                >
                  Hover to reveal
                </div>
              )}
            </div>
          }
        />
      </div>
    </section>
  );
}
