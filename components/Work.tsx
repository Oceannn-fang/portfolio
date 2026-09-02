"use client";

import { motion } from "motion/react";
import { works } from "@/lib/data";

export function Work() {
  return (
    <section
      id="work"
      style={{
        minHeight: "100vh",
        padding: "8rem 2rem",
        maxWidth: "64rem",
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
        }}
      >
        Selected Work
      </motion.h2>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {works.map((work, i) => (
          <motion.a
            key={work.title}
            href={work.url}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: i * 0.05 }}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "2rem 0",
              borderTop: "1px solid rgba(0,0,0,0.1)",
              textDecoration: "none",
              color: "var(--color-ivory)",
              position: "relative",
              overflow: "hidden",
            }}
            whileHover={{ paddingLeft: "1.5rem" }}
          >
            <motion.div
              className="work-hover-bg"
              initial={false}
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(90deg, rgba(0,0,0,0.03) 0%, transparent 60%)",
                opacity: 0,
                transition: "opacity 0.4s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.opacity = "1")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.opacity = "0")
              }
            />
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-serif-en)",
                  fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                }}
              >
                {work.title}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.75rem",
                  color: "var(--color-dim)",
                }}
              >
                {work.subtitle}
              </span>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                {work.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: "0.6rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--color-dim)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "2px",
                      padding: "0.1rem 0.45rem",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "0.75rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.8rem",
                  color: "var(--color-dim)",
                }}
              >
                {work.year}
              </span>
              <motion.span
                whileHover={{ x: 3, rotate: 90 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{
                  color: "var(--color-flame)",
                  fontSize: "1rem",
                  display: "inline-block",
                  opacity: 0.6,
                }}
              >
                &rarr;
              </motion.span>
            </div>
          </motion.a>
        ))}
      </div>
    </section>
  );
}