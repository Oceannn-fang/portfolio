"use client";

import { motion } from "motion/react";

export function PortfolioGallery() {
  return (
    <section
      id="portfolio"
      style={{
        padding: "8rem 2rem",
        maxWidth: "90rem",
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
          color: "var(--color-dim)",
          marginBottom: "4rem",
          textAlign: "center",
        }}
      >
        Portfolio
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          fontFamily: "var(--font-serif-en)",
          fontSize: "clamp(1.25rem, 2.4vw, 1.75rem)",
          lineHeight: 1.4,
          color: "var(--color-ivory)",
          maxWidth: "34rem",
          margin: "0 auto 3.5rem",
          textAlign: "center",
        }}
      >
        A horizontal stack of selected visual work, arranged as an interactive collection.
      </motion.p>
    </section>
  );
}