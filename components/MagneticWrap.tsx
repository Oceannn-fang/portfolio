'use client';
import { useRef, useCallback } from 'react';
// 项目依赖为 motion v11，导入路径是 motion/react（非 framer-motion）
import { motion, useMotionValue, useSpring } from 'motion/react';

interface Props {
  children: React.ReactNode;
  strength?: number; // 吸附强度，默认 0.3
  radius?: number; // 触发半径（px），默认 100
  block?: boolean; // 块级模式（默认 inline-block，不破坏原有布局）
}

/**
 * 磁吸包裹器 — 鼠标靠近时子元素被吸附偏移，离开弹性归位
 */
export default function MagneticWrap({ children, strength = 0.3, radius = 100, block = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!ref.current) return;
    // 触摸设备无 hover，不做磁吸
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    const dist = Math.sqrt(distX * distX + distY * distY);

    if (dist < radius) {
      x.set(distX * strength);
      y.set(distY * strength);
    }
  }, [strength, radius, x, y]);

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={block ? 'magnetic-wrap magnetic-wrap-block' : 'magnetic-wrap'}
    >
      {children}
    </motion.div>
  );
}
