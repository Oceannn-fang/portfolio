"use client";

import { motion } from "motion/react";
import { profile, timeline } from "@/lib/data";

export function About() {
  return (
    <section
      id="about"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
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
          marginBottom: "3rem",
        }}
      >
        About
      </motion.h2>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.15 }}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2.5rem",
          marginBottom: "5rem",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif-en)",
            fontSize: "clamp(1.25rem, 3vw, 2rem)",
            lineHeight: 1.5,
            color: "var(--color-ivory)",
            maxWidth: "42rem",
            fontStyle: "italic",
            letterSpacing: "-0.01em",
          }}
        >
          &ldquo;{profile.bio}&rdquo;
        </p>

        <p
          style={{
            fontFamily: "var(--font-serif-cn)",
            fontSize: "clamp(1rem, 2vw, 1.25rem)",
            lineHeight: 1.9,
            color: "var(--color-dim)",
            maxWidth: "38rem",
          }}
        >
          {profile.bioCN}
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.8, delay: 0.3 }}
        style={{ borderTop: "1px solid rgba(0,0,0,0.1)" }}
      >
        {timeline.map((item, i) => (
          <motion.div
            key={item.year}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: i * 0.05 + 0.4 }}
            style={{
              display: "flex",
              gap: "2rem",
              padding: "1.5rem 0",
              borderBottom: "1px solid rgba(0,0,0,0.08)",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: "0.7rem",
                color: "var(--color-dim)",
                minWidth: "3.5rem",
                paddingTop: "0.15rem",
                letterSpacing: "0.1em",
              }}
            >
              {item.year}
            </span>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontFamily: "var(--font-serif-en)",
                  fontSize: "1rem",
                  color: "var(--color-ivory)",
                  display: "block",
                  marginBottom: "0.15rem",
                }}
              >
                {item.title}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.75rem",
                  color: "var(--color-dim)",
                }}
              >
                {item.subtitle}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "0.7rem",
                  color: "var(--color-faint)",
                  display: "block",
                  marginTop: "0.3rem",
                }}
              >
                {item.description}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}