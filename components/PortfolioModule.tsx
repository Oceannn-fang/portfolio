'use client';

import { useMemo } from 'react';
import DriftWall from './DriftWall';
import { portfolioWorks } from '../lib/portfolio-images';
import './PortfolioModule.css';

interface PortfolioModuleProps {
  /** 当前选中的作品 ID；null 表示显示 DriftWall 总览 */
  selectedWork?: string | null;
}

/**
 * 作品集 viewer 模块：
 * - 默认（hover 行标题时）：渲染 DriftWall 3D 漂移墙，展示全部作品缩略图
 * - 选中某个作品时（hover/点击行内条目）：渲染该作品的竖屏全图
 */
export default function PortfolioModule({ selectedWork }: PortfolioModuleProps) {
  // DriftWall 图块数据（memo 保持引用稳定，避免重启动画循环）
  const items = useMemo(
    () => portfolioWorks.map((w) => ({ image: w.image, title: w.title })),
    []
  );

  const work = selectedWork ? portfolioWorks.find((w) => w.id === selectedWork) : null;

  // 单张作品全图模式
  if (work) {
    return (
      <div className="pom-root pom-single">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={work.image} alt={work.title} className="pom-single-img" />
        <div className="pom-single-title">{work.title}</div>
      </div>
    );
  }

  // 总览模式：tile 尺寸按 viewer 面板宽度（34vw ≈ 400-500px）等比缩小
  return (
    <div className="pom-root">
      <DriftWall
        items={items}
        columns={4}
        tileWidth={120}
        tileHeight={213}
        gap={8}
        tilt={10}
        turn={-8}
        perspective={1000}
        depth={60}
        speed={30}
        direction="up"
        variance={0.3}
        parallax={0.4}
        lift={30}
        fade={0.5}
        dim={0.45}
        overlayColor="#0b0b09"
        radius={6}
      />
    </div>
  );
}
