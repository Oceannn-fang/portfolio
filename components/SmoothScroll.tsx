"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenisRef.current = lenis;

    const raf = (time: number) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    const handleAnchor = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement;
      if (target.hash) {
        e.preventDefault();
        const el = document.querySelector(target.hash);
        if (el) lenis.scrollTo(el as HTMLElement, { offset: -80 });
      }
    };

    document.querySelectorAll('a[href^="#"]').forEach((a) => {
      a.addEventListener("click", handleAnchor as EventListener);
    });

    return () => {
      lenis.destroy();
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.removeEventListener("click", handleAnchor as EventListener);
      });
    };
  }, []);

  return <>{children}</>;
}
