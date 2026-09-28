"use client";

/**
 * TiltedCard — React Bits 同款鼠标跟随 3D 倾斜卡片（TS 复刻）。
 * - motion/react 的 useMotionValue + useSpring 实现倾斜与回弹
 *   （damping 30 / stiffness 100 / mass 2，与 React Bits 标准手感一致）
 * - figure 容器提供 perspective 800px，inner preserve-3d，
 *   img 随鼠标 rotateX/rotateY，tooltip 跟随鼠标并随纵向速度轻微旋转
 * - 对外 Props 与 React Bits 版保持一致，便于后续替换/对齐
 * - #56 zoomable：浮层场景支持滚轮缩放（1x~4x，中心缩放，spring 平滑）
 *   + 放大后拖拽平移 + 双击/按钮重置。缩放/平移只作用于 img 层，
 *   与 inner 层的 3D 倾斜天然分层不冲突，caption/按钮不随缩放。
 * - #58 清晰度修复：放大态（tc-zoomed）移除 img 的 will-change，让 Chromium
 *   按实际 scale 重新光栅化（常驻 will-change 会让合成层保持低分辨率纹理
 *   被 GPU 拉伸 4x → 文字晕开发糊，实验对比证实）。另内置原图加载态：
 *   shimmer 占位 + decode 完成后淡入（冷开浮层原图 4~5MB 时不白屏）。
 */
import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, useSpring } from "motion/react";
import "./TiltedCard.css";

/** 统一 spring 手感：阻尼 30 / 刚度 100 / 质量 2 */
const springValues = {
  damping: 30,
  stiffness: 100,
  mass: 2,
};

/** #56 缩放范围：1x（适应屏幕）~ 4x */
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
/** 每像素 deltaY 的缩放系数：标准滚轮一格（±100）约 ×/÷1.25 */
const ZOOM_WHEEL_FACTOR = 0.0022;

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
  /** #56 启用滚轮缩放（1x~4x）+ 拖拽平移 + 双击/按钮重置。
   *  默认开启：当前唯一消费场景是作品大图浮层（Gk3Clone 挂载，不可改）。
   *  未来独立卡片复用时显式传 false。 */
  zoomable?: boolean;
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
  zoomable = true,
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

  // ── #56 滚轮缩放 & 拖拽平移（仅 zoomable 时激活）─────────────────
  // zoom 走 spring（与倾斜手感一致）；pan 用普通 motion 值：拖拽 .set() 跟手，
  // 缩放联动/重置时用 animate() 平滑归位。只作用于 img，不碰 inner 倾斜层。
  const zoom = useSpring(1, springValues);
  const panX = useMotionValue(0);
  const panY = useMotionValue(0);
  // 即时值镜像（wheel/拖拽高频更新用，避免读 spring 动画中的中间值）
  const zoomState = useRef(1);
  const panState = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  // #58 原图加载态：decode 完成后淡入（与 PortfolioModule 单图 is-ready 同一模式）
  const [imgLoaded, setImgLoaded] = useState(false);

  /** 按当前缩放收紧平移范围：单侧可移 = 容器尺寸 × (z-1) / 2 */
  const clampPan = () => {
    const fig = ref.current;
    if (!fig) return;
    const rect = fig.getBoundingClientRect();
    const range = zoomState.current - 1;
    const maxX = (rect.width * range) / 2;
    const maxY = (rect.height * range) / 2;
    panState.current.x = Math.max(-maxX, Math.min(maxX, panState.current.x));
    panState.current.y = Math.max(-maxY, Math.min(maxY, panState.current.y));
  };

  /** 重置缩放：zoom spring 平滑回 1x，pan 动画归零（关闭/换图后从 1x 开始） */
  const resetZoom = () => {
    zoomState.current = ZOOM_MIN;
    zoom.set(ZOOM_MIN);
    panState.current = { x: 0, y: 0 };
    animate(panX, 0, springValues);
    animate(panY, 0, springValues);
    dragRef.current = null;
    setIsDragging(false);
    setIsZoomed(false);
  };

  // wheel 监听：必须原生挂载 + passive:false（React 合成 onWheel 是 passive，
  // preventDefault 无效），阻止浮层下页面滚动。上滚放大、下滚缩小，clamp 1x~4x。
  useEffect(() => {
    if (!zoomable) return;
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // line 模式换算像素
      const next = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, zoomState.current * Math.exp(-dy * ZOOM_WHEEL_FACTOR))
      );
      if (next === zoomState.current) return;
      zoomState.current = next;
      zoom.set(next); // spring 平滑过渡
      setIsZoomed(next > ZOOM_MIN + 0.001);
      // 缩小时平移可能越界，clamp 后平滑拉回（中心缩放，pan 不随 zoom 联动偏移）
      clampPan();
      if (Math.abs(panX.get() - panState.current.x) > 0.1) animate(panX, panState.current.x, springValues);
      if (Math.abs(panY.get() - panState.current.y) > 0.1) animate(panY, panState.current.y, springValues);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomable, zoom, panX, panY]);

  // 放大后拖拽平移：mousedown 记录起点，window 级 move/up 跟手（.set() 无动画）
  useEffect(() => {
    if (!zoomable || !isDragging) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      panState.current.x = d.baseX + (e.clientX - d.startX);
      panState.current.y = d.baseY + (e.clientY - d.startY);
      clampPan();
      panX.set(panState.current.x);
      panY.set(panState.current.y);
    };
    const onUp = () => {
      dragRef.current = null;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [zoomable, isDragging, panX, panY]);

  // 换图（浮层切换作品，组件未卸载）或 zoomable 首次开启时：回到 1x 起步，
  // 加载态重置（新 src 走 shimmer 占位 → decode 淡入）
  useEffect(() => {
    if (!zoomable) return;
    zoomState.current = ZOOM_MIN;
    zoom.set(ZOOM_MIN);
    panState.current = { x: 0, y: 0 };
    panX.set(0);
    panY.set(0);
    dragRef.current = null;
    setIsZoomed(false);
    setIsDragging(false);
    setImgLoaded(false);
  }, [imageSrc, zoomable, zoom, panX, panY]);

  /** 放大后按下 → 启动拖拽（1x 时不拖拽） */
  function handleImageMouseDown(e: React.MouseEvent<HTMLImageElement>) {
    if (!zoomable || zoomState.current <= ZOOM_MIN + 0.001) return;
    e.preventDefault();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: panState.current.x,
      baseY: panState.current.y,
    };
    setIsDragging(true);
  }

  function handleMouse(e: React.MouseEvent<HTMLElement>) {
    if (!ref.current) return;
    // #56 拖拽平移期间暂停倾斜（img 在动 + 倾斜在转会晕），松手恢复
    if (dragRef.current) return;
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
      className={`tilted-card-figure${zoomable ? " tc-zoomable" : ""}${isZoomed ? " tc-zoomed" : ""}${
        isDragging ? " is-dragging" : ""
      }${imgLoaded ? " img-loaded" : " img-loading"}`}
      style={{ height: containerHeight, width: containerWidth }}
      onDoubleClick={zoomable ? resetZoom : undefined}
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
        {/* #58 加载占位：原图 decode 前展示 shimmer，淡入后隐藏（缩放/倾斜均不作用于此层） */}
        <div className="tilted-card-img-placeholder" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          src={imageSrc}
          alt={altText}
          className="tilted-card-img"
          style={{ x: panX, y: panY, scale: zoom }}
          loading="lazy"
          decoding="async"
          draggable={false}
          onMouseDown={zoomable ? handleImageMouseDown : undefined}
          onLoad={(e) => {
            // 解码完成后才淡入，避免大 PNG 加载完但未解码时出现半渲染突变
            e.currentTarget
              .decode()
              .then(() => setImgLoaded(true), () => setImgLoaded(true));
          }}
          onError={() => setImgLoaded(true)}
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
      {zoomable ? (
        <button
          type="button"
          className={`tilted-card-reset${isZoomed ? " is-visible" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            resetZoom();
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          重置缩放
        </button>
      ) : null}
    </figure>
  );
}
