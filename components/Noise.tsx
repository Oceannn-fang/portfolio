"use client";

import { useRef, useEffect } from "react";
import "./Noise.css";
import { noisePhase } from "./noisePhase";

const DENSITY_MIN = 30;
const DENSITY_MAX = 70;
const INTERVAL_MIN = 1;
const INTERVAL_MAX = 5;

const easePhase = (value: number) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

type NoiseProps = {
  patternSize?: number;
  patternScaleX?: number;
  patternScaleY?: number;
  patternRefreshInterval?: number;
  patternAlpha?: number;
  patternDensity?: number;
};

const Noise = ({
  patternSize = 250,
  patternScaleX = 1,
  patternScaleY = 1,
  patternRefreshInterval = 2,
  patternAlpha = 15,
  patternDensity = 100,
}: NoiseProps) => {
  const grainRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = grainRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let frame = 0;
    let animationId: number;
    let imageData: ImageData | null = null;
    let pixels: Uint32Array | null = null;
    const maxDimension = 1024;

    const prepare = () => {
      const maxEdge = Math.max(window.innerWidth, window.innerHeight);
      const scale = Math.min(1, maxDimension / Math.max(1, maxEdge));
      const width = Math.max(64, Math.round(window.innerWidth * scale));
      const height = Math.max(64, Math.round(window.innerHeight * scale));

      canvas.width = width;
      canvas.height = height;
      canvas.style.opacity = String(Math.max(0, Math.min(1, patternAlpha / 255)));
      imageData = ctx.createImageData(width, height);
      pixels = new Uint32Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength / Uint32Array.BYTES_PER_ELEMENT
      );
    };

    const drawGrain = (densityValue: number) => {
      if (!imageData || !pixels) return;
      const cellWidth = Math.max(1, Math.round((patternSize * patternScaleX) / 100));
      const cellHeight = Math.max(1, Math.round((patternSize * patternScaleY) / 100));
      const w = canvas.width;
      const h = canvas.height;
      const densityThreshold = Math.min(100, Math.max(0, densityValue)) / 100;
      pixels.fill(0);

      if (cellWidth === 1 && cellHeight === 1) {
        for (let i = 0; i < pixels.length; i += 1) {
          if (Math.random() >= densityThreshold) continue;
          const value = Math.floor(Math.random() * 256);
          pixels[i] = (255 << 24) | (value << 16) | (value << 8) | value;
        }
      } else {
        for (let y = 0; y < h; y += cellHeight) {
          const drawHeight = Math.min(cellHeight, h - y);
          for (let x = 0; x < w; x += cellWidth) {
            if (Math.random() >= densityThreshold) continue;
            const value = Math.floor(Math.random() * 256);
            const rgba = (255 << 24) | (value << 16) | (value << 8) | value;
            const drawWidth = Math.min(cellWidth, w - x);
            for (let offsetY = 0; offsetY < drawHeight; offsetY += 1) {
              let index = (y + offsetY) * w + x;
              const end = index + drawWidth;
              while (index < end) {
                pixels[index] = rgba;
                index += 1;
              }
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const loop = () => {
      if (!document.hidden) {
        frame += 1;
        const phase = noisePhase.active ? easePhase(noisePhase.value) : 0;
        const density = noisePhase.active
          ? DENSITY_MIN + (DENSITY_MAX - DENSITY_MIN) * phase
          : patternDensity;
        const refreshInterval = noisePhase.active
          ? Math.max(1, Math.round(INTERVAL_MAX - (INTERVAL_MAX - INTERVAL_MIN) * phase))
          : patternRefreshInterval;
        if (frame % refreshInterval === 0) drawGrain(density);
      }
      animationId = window.requestAnimationFrame(loop);
    };

    const resize = () => {
      prepare();
    };

    window.addEventListener("resize", resize);
    prepare();
    loop();

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationId);
    };
  }, [patternSize, patternScaleX, patternScaleY, patternRefreshInterval, patternAlpha, patternDensity]);

  return (
    <canvas className="noise-overlay" ref={grainRef} aria-hidden="true" />
  );
};

export default Noise;
