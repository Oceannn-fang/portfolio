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
    <div className="listening-orbit">
      <div style={{ maxWidth: "100%", position: "relative" }}>
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
                    padding: "0.9rem 1.25rem",
                    borderRadius: "6px",
                    background: "var(--panel-color)",
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    border: "1px solid rgba(var(--fg-rgb), 0.22)",
                    boxShadow: "0 16px 50px rgba(0, 0, 0, 0.35)",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-serif-en)",
                      fontSize: "0.95rem",
                      fontWeight: 500,
                      color: "var(--color-bone)",
                      whiteSpace: "normal",
                      lineHeight: 1.25,
                      maxWidth: "min(280px, 64vw)",
                    }}
                  >
                    {hoveredAlbum.name}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.66rem",
                      color: "var(--color-ash-dim)",
                      marginTop: "0.18rem",
                      whiteSpace: "normal",
                      lineHeight: 1.25,
                      maxWidth: "min(280px, 64vw)",
                    }}
                  >
                    {hoveredAlbum.artist}
                  </div>
                  {hoveredAlbum.spotifyUrl ? (
                    <a
                      href={hoveredAlbum.spotifyUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        pointerEvents: "auto",
                        display: "inline-flex",
                        marginTop: "0.65rem",
                        padding: "0.35rem 0.7rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(29, 185, 84, 0.65)",
                        color: "#1db954",
                        fontFamily: "var(--font-sans)",
                        fontSize: "0.6rem",
                        letterSpacing: "0.1em",
                        textDecoration: "none",
                        textTransform: "uppercase",
                      }}
                    >
                      open in spotify ↗
                    </a>
                  ) : null}
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
                  hover to reveal
                </div>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}
