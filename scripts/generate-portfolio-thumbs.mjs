// 生成 DriftWall 缩略图：public/images/portfolio-thumbs/<id>.webp（240×428）
// 数据源：lib/portfolio-images.ts 的 portfolioWorks（id 与文件名单一来源，正则解析）
// 处理：ffmpeg libwebp（scale cover + crop，视觉与原图 object-fit:cover 一致）
// 约束：只写入 portfolio-thumbs 目录，绝不修改/删除原图
// 依赖：系统 ffmpeg（PATH 或 WinGet Links），无 npm 依赖
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TS_SOURCE = path.join(ROOT, 'lib', 'portfolio-images.ts');
const SRC_DIR = path.join(ROOT, 'public', 'images', 'portfolio');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'portfolio-thumbs');
const W = 240, H = 428, QUALITY = 80;

// 定位 ffmpeg：PATH 优先，回退 WinGet Links
function findFfmpeg() {
  const probe = (cmd) => {
    const r = spawnSync(cmd, ['-hide_banner', '-version'], { encoding: 'utf8', shell: false });
    return r.status === 0;
  };
  for (const cmd of ['ffmpeg', 'ffmpeg.exe']) {
    if (probe(cmd)) return cmd;
  }
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
  if (fs.existsSync(winget) && probe(`"${winget}"`)) return winget;
  throw new Error('ffmpeg not found (PATH / WinGet Links)');
}

// 从 lib/portfolio-images.ts 提取 { id, image 文件名 }
function parseWorks() {
  const src = fs.readFileSync(TS_SOURCE, 'utf8');
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*title:\s*'[^']*'\s*,\s*image:\s*'\/images\/portfolio\/([^']+)'\s*,\s*date:\s*'[^']+'\s*,?\s*\}/g;
  const works = [];
  let m;
  while ((m = re.exec(src)) !== null) works.push({ id: m[1], file: m[2] });
  if (works.length === 0) throw new Error(`no works parsed from ${TS_SOURCE}`);
  return works;
}

function main() {
  const ffmpeg = findFfmpeg();
  const works = parseWorks();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`ffmpeg: ${ffmpeg}`);
  console.log(`works: ${works.length}，输出 ${W}x${H} WebP q=${QUALITY} -> ${path.relative(ROOT, OUT_DIR)}`);

  let ok = 0, fail = 0, totalBytes = 0;
  const failed = [];
  for (const { id, file } of works) {
    const src = path.join(SRC_DIR, file);
    const out = path.join(OUT_DIR, `${id}.webp`);
    if (!fs.existsSync(src)) {
      fail++; failed.push(`${id}（原图缺失: ${file}）`);
      continue;
    }
    const args = [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', src,
      '-vf', `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
      '-frames:v', '1',
      '-c:v', 'libwebp', '-q:v', String(QUALITY),
      out,
    ];
    const r = spawnSync(ffmpeg, args, { encoding: 'utf8', shell: false, windowsVerbatimArguments: false });
    if (r.status !== 0 || !fs.existsSync(out)) {
      fail++; failed.push(`${id}（ffmpeg exit ${r.status}: ${String(r.stderr).trim().slice(0, 200)}）`);
      continue;
    }
    const bytes = fs.statSync(out).size;
    totalBytes += bytes;
    ok++;
    console.log(`  ok ${id}.webp  ${(bytes / 1024).toFixed(1)} KB  <- ${file}`);
  }

  console.log(`\n完成: ${ok} 成功 / ${fail} 失败，总体积 ${(totalBytes / 1024).toFixed(1)} KB`);
  if (failed.length) {
    console.log('失败清单:');
    for (const f of failed) console.log(`  ${f}`);
    process.exit(1);
  }
}

main();
