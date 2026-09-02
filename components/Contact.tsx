"use client";

import { motion } from "motion/react";
import { useRef, useState } from "react";
import { profile } from "@/lib/data";

export function Contact() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const copyEmail = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    try {
      await navigator.clipboard.writeText(profile.email);
    } catch {
      window.prompt("Copy email", profile.email);
    }
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

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
          color: "var(--color-dim)",
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
          color: "var(--color-dim)",
          marginBottom: "2rem",
          letterSpacing: "0.05em",
        }}
      >
        随时联系
      </motion.p>

      <motion.a
        href={`mailto:${profile.email}`}
        onClick={copyEmail}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.8, delay: 0.2 }}
        style={{
          fontFamily: "var(--font-serif-en)",
          fontSize: "clamp(1.5rem, 5vw, 3.5rem)",
          color: "var(--color-ivory)",
          textDecoration: "none",
          marginBottom: "1.5rem",
          position: "relative",
          transition: "color 0.3s",
          letterSpacing: "-0.01em",
          cursor: "pointer",
        }}
        onMouseEnter={(e) =>
          (e.currentTarget.style.color = "var(--color-flame)")
        }
        onMouseLeave={(e) =>
          (e.currentTarget.style.color = "var(--color-ivory)")
        }
      >
        {profile.email}
      </motion.a>

      <motion.p
        aria-live="polite"
        style={{
          height: "1rem",
          fontFamily: "var(--font-sans)",
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--color-dim)",
          marginBottom: "3rem",
        }}
      >
        {copied ? "Email copied" : ""}
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, delay: 0.5 }}
        style={{ display: "flex", gap: "2.5rem", flexWrap: "wrap", justifyContent: "center" }}
      >
        {profile.socials.map((social) => (
          <a
            key={social.label}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.75rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--color-dim)",
              textDecoration: "none",
              position: "relative",
              transition: "color 0.3s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--color-ivory)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--color-dim)")
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
          color: "var(--color-faint)",
        }}
      >
        Next.js / Motion / Tailwind
      </motion.p>
    </section>
  );
}