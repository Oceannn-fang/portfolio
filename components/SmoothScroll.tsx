"use client";

import { useEffect } from "react";

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Smooth anchor scrolling with native scroll behavior
    const handleAnchor = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement;
      if (target.hash && target.hash.startsWith("#")) {
        const el = document.querySelector(target.hash);
        if (el) {
          e.preventDefault();
          const top = el.getBoundingClientRect().top + window.scrollY - 80;
          window.scrollTo({ top, behavior: "smooth" });
        }
      }
    };

    const anchors = document.querySelectorAll('a[href^="#"]');
    anchors.forEach((a) => {
      a.addEventListener("click", handleAnchor as EventListener);
    });

    return () => {
      anchors.forEach((a) => {
        a.removeEventListener("click", handleAnchor as EventListener);
      });
    };
  }, []);

  return <>{children}</>;
}
