"use client";

import { motion, useScroll, useTransform, useMotionValue } from "motion/react";
import { useRef, useEffect, useState } from "react";
import { profile } from "@/lib/data";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 150]);

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseX.set(e.clientX / window.innerWidth);
      mouseY.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => window.removeEventListener("mousemove", onMouse);
  }, [mouseX, mouseY]);

  const glareX = useTransform(mouseX, [0, 1], [0, 40]);
  const glareY = useTransform(mouseY, [0, 1], [0, 40]);

  return (
    <section
      ref={ref}
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "0 2rem",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient light effect */}
      <motion.div
        style={{
          position: "absolute",
          width: "60vw",
          height: "60vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(107,158,255,0.04) 0%, transparent 70%)",
          translateX: glareX,
          translateY: glareY,
          top: "20%",
          pointerEvents: "none",
        }}
      />

      <motion.div style={{ opacity, y }}>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.75rem",
            letterSpacing: "0.4em",
            textTransform: "uppercase",
            color: "var(--color-ash-dim)",
            textAlign: "center",
            marginBottom: "1.5rem",
          }}
        >
          {profile.tagline}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontFamily: "var(--font-serif-en)",
            fontSize: "clamp(3rem, 12vw, 9rem)",
            lineHeight: 0.95,
            textAlign: "center",
            color: "var(--color-bone)",
            letterSpacing: "-0.03em",
            background:
              "linear-gradient(135deg, var(--color-bone) 40%, var(--color-blue-ice) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {profile.name}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          style={{
            fontFamily: "var(--font-serif-cn)",
            fontSize: "clamp(1rem, 2.5vw, 1.5rem)",
            color: "var(--color-ash)",
            textAlign: "center",
            marginTop: "1.5rem",
            letterSpacing: "0.08em",
          }}
        >
          {profile.taglineCN}
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
        style={{
          position: "absolute",
          bottom: "3rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
          color: "var(--color-ash-dim)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "0.65rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          style={{
            width: "1px",
            height: "40px",
            background:
              "linear-gradient(to bottom, var(--color-ash-dim), transparent)",
          }}
        />
      </motion.div>
    </section>
  );
}
