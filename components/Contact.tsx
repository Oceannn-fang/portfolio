"use client";

import { motion } from "motion/react";
import { profile } from "@/lib/data";

export function Contact() {
  return (
    <section
      id="contact"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "6rem 2rem",
        textAlign: "center",
        position: "relative",
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
          marginBottom: "3rem",
        }}
      >
        Contact
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          fontFamily: "var(--font-serif-cn)",
          fontSize: "clamp(0.9rem, 1.5vw, 1.1rem)",
          color: "var(--color-ash)",
          marginBottom: "2rem",
          letterSpacing: "0.05em",
        }}
      >
        随时联系
      </motion.p>

      <motion.a
        href={`mailto:${profile.email}`}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.2 }}
        data-cursor="link"
        style={{
          fontFamily: "var(--font-serif-en)",
          fontSize: "clamp(1.5rem, 5vw, 3.5rem)",
          color: "var(--color-bone)",
          textDecoration: "none",
          marginBottom: "4rem",
          position: "relative",
          transition: "color 0.3s",
          letterSpacing: "-0.01em",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--color-blue-ice)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--color-bone)")
        }
      >
        {profile.email}
      </motion.a>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.5 }}
        style={{ display: "flex", gap: "2.5rem" }}
      >
        {profile.socials.map((social) => (
          <a
            key={social.label}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="link"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-ash)",
              textDecoration: "none",
              position: "relative",
              transition: "color 0.3s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--color-blue-ice)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--color-ash)")
            }
          >
            {social.label}
          </a>
        ))}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1, delay: 0.8 }}
        style={{
          marginTop: "6rem",
          fontFamily: "var(--font-sans)",
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-ash-dim)",
        }}
      >
        Next.js / Motion / Tailwind
      </motion.p>
    </section>
  );
}
