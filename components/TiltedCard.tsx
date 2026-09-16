"use client";

/**
 * TiltedCard — React Bits 同款鼠标跟随 3D 倾斜卡片（TS 复刻）。
 * - motion/react 的 useMotionValue + useSpring 实现倾斜与回弹
 *   （damping 30 / stiffness 100 / mass 2，与 React Bits 标准手感一致）
 * - figure 容器提供 perspective 800px，inner preserve-3d，
 *   img 随鼠标 rotateX/rotateY，tooltip 跟随鼠标并随纵向速度轻微旋转
 * - 对外 Props 与 React Bits 版保持一致，便于后续替换/对齐
 */
import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import "./TiltedCard.css";

/** 统一 spring 手感：阻尼 30 / 刚度 100 / 质量 2 */
const springValues = {
  damping: 30,
  stiffness: 100,
  mass: 2,
};

export interface TiltedCardProps {
  /** 图片地址（浮层场景传原图） */
  imageSrc: string;
  /** 图片 alt 文本 */
  altText?: string;
  /** tooltip 跟随文案（作品标题） */
  captionText?: string;
  /** figure 容器高（CSS 值，支持 min()/vh/vw） */
  containerHeight?: string | number;
  /** figure 容器宽 */
  containerWidth?: string | number;
  /** 图片高（相对 inner，通常 100% 由容器约束） */
  imageHeight?: string | number;
  /** 图片宽 */
  imageWidth?: string | number;
  /** 倾斜幅度（deg） */
  rotateAmplitude?: number;
  /** hover 放大倍数 */
  scaleOnHover?: number;
  /** 是否渲染移动端体验提示 */
  showMobileWarning?: boolean;
  /** 是否显示跟随 tooltip */
  showTooltip?: boolean;
  /** 是否渲染 overlayContent 浮层内容 */
  displayOverlayContent?: boolean;
  /** overlay 浮层内容 */
  overlayContent?: React.ReactNode;
}

export default function TiltedCard({
  imageSrc,
  altText = "",
  captionText = "",
  containerHeight = "300px",
  containerWidth = "100%",
  imageHeight = "300px",
  imageWidth = "300px",
  rotateAmplitude = 14,
  scaleOnHover = 1.1,
  showMobileWarning = true,
  showTooltip = true,
  displayOverlayContent = false,
  overlayContent = null,
}: TiltedCardProps) {
  const ref = useRef<HTMLElement>(null);
  // tooltip 跟随位置（相对 figure 左上角）
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // 倾斜与缩放（spring 回弹）
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const opacity = useSpring(0);
  // tooltip 随纵向速度的轻微旋转
  const rotateFigcaption = useSpring(0, { stiffness: 350, damping: 30, mass: 1 });
  const [lastY, setLastY] = useState(0);

  function handleMouse(e: React.MouseEvent<HTMLElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    // 鼠标越靠边倾斜越大，中心为 0
    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);

    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);

    // 纵向速度映射到 tooltip 旋转，制造“甩动”手感
    const velocityY = offsetY - lastY;
    rotateFigcaption.set(-velocityY * 0.6);
    setLastY(offsetY);
  }

  return (
    <figure
      ref={ref}
      className="tilted-card-figure"
      style={{ height: containerHeight, width: containerWidth }}
      onMouseMove={handleMouse}
      onMouseEnter={() => {
        scale.set(scaleOnHover);
        opacity.set(1);
      }}
      onMouseLeave={() => {
        opacity.set(0);
        scale.set(1);
        rotateX.set(0);
        rotateY.set(0);
      }}
    >
      {showMobileWarning && (
        <div className="tilted-card-mobile-alert">
          This effect is not optimized for mobile usage. Please switch to desktop for the best
          experience.
        </div>
      )}
      <motion.div
        className="tilted-card-inner"
        style={{
          width: imageWidth,
          height: imageHeight,
          rotateX,
          rotateY,
          scale,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 2 }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={altText}
          className="tilted-card-img"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {displayOverlayContent && overlayContent ? (
          <motion.div className="tilted-card-overlay">{overlayContent}</motion.div>
        ) : null}
      </motion.div>
      {showTooltip ? (
        <motion.figcaption
          className="tilted-card-caption"
          style={{ x, y, opacity, rotate: rotateFigcaption }}
        >
          {captionText}
        </motion.figcaption>
      ) : null}
    </figure>
  );
}
