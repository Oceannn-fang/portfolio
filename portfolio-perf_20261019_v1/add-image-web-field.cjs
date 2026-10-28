#!/usr/bin/env node
/**
 * 为 lib/portfolio-images.ts 的每个条目补上 imageWeb 字段（方案 A 第 2 步）
 *
 * - 在 image 之后、thumb 之前插入：imageWeb: '/images/portfolio/web/<id>.webp',
 * - 幂等：已含 imageWeb 的行跳过；无匹配行时不做任何写入
 * - 保持原有 2 空格缩进、单引号、LF
 *
 * 用法：node add-image-web-field.cjs <registryPath> [--check]
 *   --check  只报告需要改动的行数，不写文件
 */
const fs = require('node:fs');

const registryPath = process.argv[2];
const checkOnly = process.argv.includes('--check');
if (!registryPath) {
  console.error('用法: node add-image-web-field.cjs <registryPath> [--check]');
  process.exit(2);
}

const text = fs.readFileSync(registryPath, 'utf8');
const lines = text.split('\n');
let changed = 0;
const out = lines.map((line) => {
  const m = line.match(/^\s*\{ id: '([^']+)',/);
  if (!m) return line;
  if (line.includes('imageWeb:')) return line;
  if (!line.includes(", thumb: '")) return line;
  changed += 1;
  return line.replace(", thumb: '", `, imageWeb: '/images/portfolio/web/${m[1]}.webp', thumb: '`);
});

if (changed === 0) {
  console.log('无需改动（条目已有 imageWeb 或未匹配到条目）');
  process.exit(0);
}

if (checkOnly) {
  console.log(`--check：需要为 ${changed} 个条目补 imageWeb 字段（未写入）`);
  process.exit(0);
}

fs.writeFileSync(registryPath, out.join('\n'), 'utf8');
console.log(`已为 ${changed} 个条目补上 imageWeb 字段: ${registryPath}`);
