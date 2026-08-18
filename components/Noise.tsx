"use client";

import { useRef, useEffect } from "react";
import "./Noise.css";

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
    const canvasSize = 256;
    const imageData = ctx.createImageData(canvasSize, canvasSize);

    const resize = () => {
      if (!canvas) return;
      canvas.width = canvasSize;
      canvas.height = canvasSize;

      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
    };

    const drawGrain = () => {
      const cellWidth = Math.max(1, Math.round((patternSize * patternScaleX) / 100));
      const cellHeight = Math.max(1, Math.round((patternSize * patternScaleY) / 100));
      const data = imageData.data;
      data.fill(0);

      for (let y = 0; y < canvasSize; y += cellHeight) {
        const drawHeight = Math.min(cellHeight, canvasSize - y);
        for (let x = 0; x < canvasSize; x += cellWidth) {
          if (Math.random() * 100 >= patternDensity) continue;
          const value = Math.floor(Math.random() * 256);
          const drawWidth = Math.min(cellWidth, canvasSize - x);
          for (let offsetY = 0; offsetY < drawHeight; offsetY += 1) {
            let index = ((y + offsetY) * canvasSize + x) * 4;
            for (let offsetX = 0; offsetX < drawWidth; offsetX += 1) {
              data[index] = value;
              data[index + 1] = value;
              data[index + 2] = value;
              data[index + 3] = patternAlpha;
              index += 4;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const loop = () => {
      if (!document.hidden && frame % patternRefreshInterval === 0) {
        drawGrain();
      }
      frame++;
      animationId = window.requestAnimationFrame(loop);
    };

    window.addEventListener("resize", resize);
    resize();
    loop();

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationId);
    };
  }, [patternSize, patternScaleX, patternScaleY, patternRefreshInterval, patternAlpha, patternDensity]);

  return (
    <canvas
      className="noise-overlay"
      ref={grainRef}
      aria-hidden="true"
      style={{ imageRendering: "pixelated" }}
    />
  );
};

export default Noise;
