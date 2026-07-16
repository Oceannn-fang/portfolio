"use client";

import { useEffect, useRef } from "react";

export function GrainOverlay() {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.createImageData(size, size);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.floor(Math.random() * 256);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");

    if (divRef.current) {
      divRef.current.style.backgroundImage = `url("${dataUrl}")`;
    }
  }, []);

  return (
    <div
      ref={divRef}
      className="grain-overlay"
      aria-hidden="true"
    />
  );
}
