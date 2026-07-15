"use client";

import { useEffect, useRef } from "react";

export function CursorFollower() {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const rAFRef = useRef<number>(0);

  useEffect(() => {
    const cursor = document.createElement("div");
    cursor.style.cssText = `
      position: fixed;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: rgba(237, 232, 213, 0.5);
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                  height 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                  background-color 0.4s cubic-bezier(0.22, 1, 0.36, 1),
                  border-color 0.4s cubic-bezier(0.22, 1, 0.36, 1);
      mix-blend-mode: difference;
      border: 0px solid transparent;
    `;
    document.body.appendChild(cursor);

    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;

    const onMouse = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const expand = () => {
      cursor.style.width = "32px";
      cursor.style.height = "32px";
      cursor.style.backgroundColor = "rgba(107, 158, 255, 0.08)";
      cursor.style.border = "1px solid rgba(107, 158, 255, 0.3)";
    };

    const shrink = () => {
      cursor.style.width = "8px";
      cursor.style.height = "8px";
      cursor.style.backgroundColor = "rgba(237, 232, 213, 0.5)";
      cursor.style.border = "0px solid transparent";
    };

    const onHoverIn = () => expand();
    const onHoverOut = () => shrink();

    document.querySelectorAll("a, button, [data-cursor='link']").forEach((el) => {
      el.addEventListener("mouseenter", onHoverIn);
      el.addEventListener("mouseleave", onHoverOut);
    });

    const obs = new MutationObserver(() => {
      document.querySelectorAll("a, button, [data-cursor='link']").forEach((el) => {
        el.removeEventListener("mouseenter", onHoverIn);
        el.removeEventListener("mouseleave", onHoverOut);
        el.addEventListener("mouseenter", onHoverIn);
        el.addEventListener("mouseleave", onHoverOut);
      });
    });
    obs.observe(document.body, { childList: true, subtree: true });

    const animate = () => {
      currentX += (mouseX - currentX) * 0.1;
      currentY += (mouseY - currentY) * 0.1;
      cursor.style.left = `${currentX}px`;
      cursor.style.top = `${currentY}px`;
      rAFRef.current = requestAnimationFrame(animate);
    };
    rAFRef.current = requestAnimationFrame(animate);
    window.addEventListener("mousemove", onMouse, { passive: true });

    return () => {
      cancelAnimationFrame(rAFRef.current);
      cursor.remove();
      window.removeEventListener("mousemove", onMouse);
      obs.disconnect();
    };
  }, []);

  return null;
}
