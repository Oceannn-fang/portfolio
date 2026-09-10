'use client';

import DriftWall from '@/components/DriftWall';
import { portfolioWorks } from '@/lib/portfolio-images';

/**
 * DriftWall 独立测试页面
 * 用于在嵌入正式页面前单独验证 3D 漂移墙效果。
 * 访问路径：/driftwall-test
 */
export default function DriftWallTest() {
  const items = portfolioWorks.map(w => ({
    image: w.image,
    title: w.title,
  }));

  return (
    <div style={{ width: '100%', height: '100vh', background: '#0b0b09' }}>
      <DriftWall
        items={items}
        columns={4}
        tileWidth={180}
        tileHeight={320}
        gap={14}
        tilt={12}
        turn={-10}
        perspective={1200}
        depth={80}
        speed={35}
        direction="up"
        variance={0.3}
        parallax={0.5}
        lift={50}
        fade={0.6}
        dim={0.5}
        overlayColor="#0b0b09"
        radius={8}
      />
    </div>
  );
}
