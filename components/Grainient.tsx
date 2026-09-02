"use client";

import { useEffect, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";
import "./Grainient.css";

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 iResolution;
uniform float iTime;
out vec4 fragColor;

uniform float uGrainAmount;
uniform float uGrainScale;
uniform float uGrainAnimated;
uniform float uGrainSpeed;
uniform float uGrainDensity;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  
  vec2 gUv = uv * max(uGrainScale, 0.001);
  if (uGrainAnimated > 0.5) {
    float gs = max(uGrainSpeed, 0.001);
    gUv += vec2(iTime * 0.3 * gs, iTime * 0.2 * gs);
  }
  
  float gR = fract(sin(dot(gUv, vec2(12.9898, 78.233))) * 43758.5453);
  
  float breath = 0.6 + 0.4 * sin(iTime * 0.5);
  
  float threshold = 1.0 - max(uGrainDensity, 0.001);
  float grainMask = step(threshold, gR);
  
  float grainIntensity = grainMask * uGrainAmount * breath;
  
  vec3 col = mix(vec3(1.0, 1.0, 1.0), vec3(0.0, 0.0, 0.0), grainIntensity);
  
  fragColor = vec4(col, 1.0);
}
`;

const ctxMap = new WeakMap();

interface GrainientProps {
  grainAmount?: number;
  grainScale?: number;
  grainAnimated?: boolean;
  grainSpeed?: number;
  grainDensity?: number;
  className?: string;
}

const Grainient = ({
  grainAmount = 0.8,
  grainScale = 40.0,
  grainAnimated = true,
  grainSpeed = 0.3,
  grainDensity = 0.03,
  className = "",
}: GrainientProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      webgl: 2,
      alpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });

    const gl = renderer.gl;
    const canvas = gl.canvas;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iTime: { value: 0 },
        iResolution: { value: new Float32Array([1, 1]) },
        uGrainAmount: { value: grainAmount },
        uGrainScale: { value: grainScale },
        uGrainAnimated: { value: grainAnimated ? 1.0 : 0.0 },
        uGrainSpeed: { value: grainSpeed },
        uGrainDensity: { value: grainDensity },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });
    ctxMap.set(container, { renderer, program, mesh });

    const setSize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      renderer.setSize(w, h);
      const res = program.uniforms.iResolution.value;
      res[0] = gl.drawingBufferWidth;
      res[1] = gl.drawingBufferHeight;
      renderer.render({ scene: mesh });
    };

    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    setSize();

    let raf = 0;
    let isVisible = true;
    let isPageVisible = !document.hidden;
    const t0 = performance.now();

    const loop = (t: number) => {
      program.uniforms.iTime.value = (t - t0) * 0.001;
      renderer.render({ scene: mesh });
      raf = requestAnimationFrame(loop);
    };

    const tryStart = () => {
      if (isVisible && isPageVisible && raf === 0)
        raf = requestAnimationFrame(loop);
    };
    const tryStop = () => {
      if (raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        isVisible ? tryStart() : tryStop();
      },
      { threshold: 0 }
    );
    io.observe(container);

    const onVisibility = () => {
      isPageVisible = !document.hidden;
      isPageVisible ? tryStart() : tryStop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    tryStart();

    return () => {
      tryStop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      ctxMap.delete(container);
      try {
        container.removeChild(canvas);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`grainient-container ${className}`.trim()}
    />
  );
};

export default Grainient;
