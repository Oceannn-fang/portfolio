"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import CardSwap, { Card } from "@/components/CardSwap";
import { portfolioImages } from "@/lib/data";

export function PortfolioGallery() {
  const [modalIdx, setModalIdx] = useState<number | null>(null);

  return (
    <section
      id="work"
      style={{
        padding: "8rem 2rem",
        maxWidth: "80rem",
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
          textAlign: "center",
        }}
      >
        Artworks
      </motion.h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3rem",
          alignItems: "center",
          maxWidth: "72rem",
          margin: "0 auto",
        }}
      >
        <div style={{ paddingRight: "1rem" }}>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontFamily: "var(--font-serif-en)",
              fontSize: "1.75rem",
              lineHeight: 1.4,
              color: "var(--color-bone)",
              marginBottom: "1.5rem",
              fontWeight: 400,
            }}
          >
            Selected works
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.85rem",
              lineHeight: 1.7,
              color: "var(--color-ash)",
              maxWidth: "24rem",
            }}
          >
            A curated collection of album art, posters, and visual explorations.
            Click on any piece to view in full.
          </motion.p>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "580px",
          }}
        >
          <CardSwap
            width={280}
            height={480}
            cardDistance={25}
            verticalDistance={30}
            delay={5000}
            pauseOnHover={true}
            easing="linear"
            skewAmount={4}
            onCardClick={(idx) => setModalIdx(idx)}
          >
            {portfolioImages.map((img) => (
              <Card key={img.title}>
                <img src={img.src} alt={img.title} />
                <div className="card-info">
                  <span className="title">{img.title}</span>
                </div>
              </Card>
            ))}
          </CardSwap>
        </div>
      </div>

      <AnimatePresence>
        {modalIdx !== null && (
          <motion.div
            key="modal"
            className="gallery-modal"
            initial={{ scale: 0.7, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: 60 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => setModalIdx(null)}
            onKeyDown={(e) => { if (e.key === "Escape") setModalIdx(null); }}
            tabIndex={0}
            role="dialog"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: "2rem",
            }}
          >
            <motion.div
              layout
              style={{
                maxWidth: "calc(100vw - 4rem)",
                maxHeight: "calc(100vh - 4rem)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "default",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={portfolioImages[modalIdx].src}
                alt={portfolioImages[modalIdx].title}
                className="gallery-modal-img"
              />
              <div
                style={{
                  marginTop: "1rem",
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  color: "var(--color-ash-dim)",
                  letterSpacing: "0.05em",
                }}
              >
                {portfolioImages[modalIdx].title}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}