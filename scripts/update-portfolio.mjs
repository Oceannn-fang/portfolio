#!/usr/bin/env node
/**
 * 作品图片标准化更新管线（#88）
 * 一条命令完成：扫描 OneDrive 存档 → 差集（未注册的新作品）→ 原图拷贝
 * → ffmpeg 生成 240×428 WebP 缩略图 → portfolioWorks 数组置顶插入注册条目。
 *
 * 参照 #42 既有接入惯例：
 *   Copy-Item 原图 → ffmpeg scale=240:428:force_original_aspect_ratio=increase
 *   + crop + libwebp -q:v 80 → portfolioWorks 置顶插入（单行条目，2 空格缩进，
 *   单引号风格，与 lib/portfolio-images.ts 现有 35 条一致）。
 *
 * slug 规则（归纳自现有 35 条数据）：
 *   - 文件名含拉丁词：小写 + 连字符 + 去撇号（There’s Something... →
 *     theres-something-here-for-us-both；Life & space → life-and-space）。
 *   - 纯 CJK 文件名：现有条目的 id 全部为人工语义英译（晚餐見→dinner-view、
 *     一顆灰塵→a-speck-of-dust、明明→mingming），无法自动派生 → 回退
 *     work-<YYYYMMDD> 占位并在报告中醒目提示人工审阅（与 #62 用户拍板人工
 *     定 id 的惯例一致）。
 *
 * 幂等：以注册表中的 image 文件名集合（取 basename + NFC 规范化后比对，规避 U+2019 码点
 * 差异）做差集，已注册一律跳过；无新作品零写入。
 *
 * 用法：
 *   node scripts/update-portfolio.mjs [--src <dir>] [--date YYYY-MM-DD]
 *        [--dry-run] [--registry <path>] [--public-dir <path>] [--thumbs-dir <path>]
 *   --src         源目录（默认 C:\Users\86185\OneDrive\图片\存档）
 *   --date        覆盖注册条目 date（默认取文件 mtime 的 YYYY-MM-DD）
 *   --dry-run     只打印动作预览，零写入
 *   --registry/--public-dir/--thumbs-dir  目标重定向（测试隔离用，默认项目真实路径）
 *
 * 依赖：Node 18+、系统 ffmpeg（PATH 或 WinGet Links），无 npm 依赖。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_SRC = 'C:\\Users\\86185\\OneDrive\\图片\\存档';
const DEFAULT_REGISTRY = path.join(ROOT, 'lib', 'portfolio-images.ts');
const DEFAULT_PUBLIC = path.join(ROOT, 'public', 'images', 'portfolio');
const DEFAULT_THUMBS = path.join(ROOT, 'public', 'images', 'portfolio-thumbs');
const THUMB_W = 240, THUMB_H = 428, THUMB_Q = 80;

// ── ANSI 彩色（非 TTY / NO_COLOR 时自动去色） ──
const colorEnabled = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = (s) => c(1, s);
const green = (s) => c(32, s);
const yellow = (s) => c(33, s);
const red = (s) => c(31, s);
const cyan = (s) => c(36, s);
const gray = (s) => c(90, s);

// ── CLI 参数 ──
function parseArgs(argv) {
  const opts = {
    src: DEFAULT_SRC, date: null, dryRun: false,
    registry: DEFAULT_REGISTRY, publicDir: DEFAULT_PUBLIC, thumbsDir: DEFAULT_THUMBS,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--src') opts.src = path.resolve(argv[++i]);
    else if (a === '--date') opts.date = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--registry') opts.registry = path.resolve(argv[++i]);
    else if (a === '--public-dir') opts.publicDir = path.resolve(argv[++i]);
    else if (a === '--thumbs-dir') opts.thumbsDir = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') { printHelp(); process.exit(0); }
    else { console.error(red(`未知参数: ${a}（--help 查看用法）`)); process.exit(2); }
  }
  return opts;
}

function printHelp() {
  console.log(`作品图片标准化更新管线（#88）
用法: node scripts/update-portfolio.mjs [选项]
  --src <dir>        源目录（默认 ${DEFAULT_SRC}）
  --date <YYYY-MM-DD> 覆盖注册条目 date（默认文件 mtime）
  --dry-run          只预览将要执行的动作，零写入
  --registry <path>  注册表 TS 路径（默认 lib/portfolio-images.ts；测试隔离用）
  --public-dir <p>   原图目录（默认 public/images/portfolio；测试隔离用）
  --thumbs-dir <p>   缩略图目录（默认 public/images/portfolio-thumbs；测试隔离用）`);
}

// ── ffmpeg 定位（与 generate-portfolio-thumbs.mjs 同策略：PATH 优先，回退 WinGet Links） ──
function findFfmpeg() {
  const probe = (cmd) => spawnSync(cmd, ['-hide_banner', '-version'], { encoding: 'utf8', shell: false }).status === 0;
  for (const cmd of ['ffmpeg', 'ffmpeg.exe']) if (probe(cmd)) return cmd;
  const winget = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ffmpeg.exe');
  if (fs.existsSync(winget) && probe(winget)) return winget;
  return null;
}

const nfc = (s) => s.normalize('NFC');
const baseName = (p) => nfc(path.basename(p));
const stemOf = (f) => f.replace(/\.(png|psd)$/i, '');

// ── 扫描源目录：png（新作品候选）+ psd（无同名 png 的列入跳过清单） ──
function scanSource(srcDir) {
  if (!fs.existsSync(srcDir)) throw new Error(`源目录不存在: ${srcDir}`);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => nfc(e.name));
  const pngs = entries.filter((n) => n.toLowerCase().endsWith('.png'));
  const psds = entries.filter((n) => n.toLowerCase().endsWith('.psd'));
  const pngStems = new Set(pngs.map(stemOf));
  const orphanPsds = psds.filter((n) => !pngStems.has(stemOf(n)));
  return { pngs, orphanPsds };
}

// ── 解析注册表：已注册 image 文件名集合 + 现有 id 集合 + 换行风格 ──
// 字符串值解析与 tsStr 生成对称：单引号（原样）/ 双引号（JSON 转义，JSON.parse 还原）——
// 含 ASCII 撇号的文件名会被写入双引号字面量，解析必须能还原，否则幂等差集漏判（#88 E2E 实测 bug）
function parseTsString(raw, isDouble) {
  if (!isDouble) return raw;
  try { return JSON.parse('"' + raw + '"'); } catch { return raw; }
}
function parseRegistry(registryPath) {
  if (!fs.existsSync(registryPath)) throw new Error(`注册表不存在: ${registryPath}`);
  const text = fs.readFileSync(registryPath, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const registered = new Set();
  const re = /image:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  let m;
  // image 值是 /images/portfolio/<文件名> 路径，取 basename 转为纯文件名后再比对（差集用文件名）；
  // 否则 registered 全是路径、pending 永不命中，幂等彻底失效（#88 E2E 二跑实测 bug）
  while ((m = re.exec(text)) !== null) {
    const v = parseTsString(m[1] !== undefined ? m[1] : m[2], m[1] === undefined);
    registered.add(nfc(path.basename(v)));
  }
  const ids = new Set();
  const reId = /\bid:\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  while ((m = reId.exec(text)) !== null) ids.add(parseTsString(m[1] !== undefined ? m[1] : m[2], m[1] === undefined));
  if (registered.size === 0) throw new Error(`注册表解析到 0 条条目，锚点异常: ${registryPath}`);
  return { text, eol, registered, ids };
}

// ── slug：提取含字母的拉丁 token（纯数字不算），小写+去撇号+连字符 ──
function makeSlug(stem) {
  const tokens = stem.match(/[A-Za-z0-9'’]+/g) || [];
  const latin = tokens
    .filter((t) => /[A-Za-z]/.test(t))
    .map((t) => t.toLowerCase().replace(/['’]/g, ''));
  return latin.join('-');
}

// Title Case（#62 惯例：虚词小写、首词大写；CJK 字符原样保留）
const MINOR_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'it']);
function makeTitle(stem) {
  return stem
    .split(/(\s+)/)
    .map((part, idx, arr) => {
      if (/^\s+$/.test(part)) return part;
      if (!/[A-Za-z]/.test(part)) return part; // CJK/标点原样
      const lower = part.toLowerCase();
      const isFirst = arr.slice(0, idx).every((p) => /^\s*$/.test(p));
      const isLast = arr.slice(idx + 1).every((p) => /^\s*$/.test(p));
      if (!isFirst && !isLast && MINOR_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

// TS 字符串字面量：默认单引号（现有风格）；含 ASCII 撇号/反斜杠时回退 JSON 双引号（合法性优先）
const tsStr = (s) => (/['\\]/.test(s) ? JSON.stringify(s) : `'${s}'`);

function pad2(n) { return String(n).padStart(2, '0'); }
function mtimeDate(f) {
  const d = fs.statSync(f).mtime;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ── 主流程 ──
function main() {
  const opts = parseArgs(process.argv);
  console.log(bold(cyan('═══ 作品图片标准化更新管线 #88 ═══')));
  if (opts.dryRun) console.log(yellow('（--dry-run 预览模式：零写入）'));

  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.error(red('错误: 未找到 ffmpeg（PATH 与 WinGet Links 均失败）。'));
    console.error(gray('  安装: winget install Gyan.FFmpeg 后重开终端，或将其加入 PATH。'));
    process.exit(1);
  }

  // 1. 扫描源目录
  const { pngs, orphanPsds } = scanSource(opts.src);
  console.log(gray(`源目录: ${opts.src}`));
  console.log(`扫描到 ${pngs.length} 张 PNG / ${orphanPsds.length} 个无同名 PNG 的 PSD`);

  // 2. 读注册表（差集基准）
  const reg = parseRegistry(opts.registry);
  console.log(gray(`注册表: ${opts.registry}（${reg.registered.size} 条已注册）`));

  // 3. 差集 = 新作品；已注册 = skipped
  const pending = pngs.filter((f) => !reg.registered.has(f));
  const skipped = pngs.filter((f) => reg.registered.has(f));

  if (pending.length === 0) {
    console.log(green(`\n无新作品，0 改动（已注册 ${skipped.length} 张 PNG 全部跳过）。`));
  } else {
    console.log(bold(`\n发现 ${pending.length} 张新作品:`));
  }
  for (const f of skipped) console.log(gray(`  skipped（已注册）: ${f}`));

  // psd 跳过清单
  if (orphanPsds.length > 0) {
    console.log(yellow('\n以下 PSD 无同名 PNG，需先从 Photoshop 导出 PNG 后重跑:'));
    for (const p of orphanPsds) console.log(yellow(`  psd 待导出: ${p}`));
  }

  if (pending.length === 0) { console.log(green('\n完成。')); return; }

  // 4. 为每张新图构建计划（slug/title/date/冲突检查）
  const plans = [];
  const errors = [];
  const batchSlugs = new Set();
  for (const file of pending) {
    const srcPath = path.join(opts.src, file);
    const stem = stemOf(file);
    const ext = path.extname(file);
    const date = opts.date || mtimeDate(srcPath);

    let slug = makeSlug(stem);
    let needsManualId = false;
    if (!slug) { slug = `work-${date.replace(/-/g, '')}`; needsManualId = true; }
    if (reg.ids.has(slug) || batchSlugs.has(slug)) {
      errors.push(red(`  ✗ ${file}: slug "${slug}" 与现有 id 冲突，请人工处理后再运行`));
      continue;
    }
    batchSlugs.add(slug);

    const copyDest = path.join(opts.publicDir, file);
    const thumbName = `${slug}.webp`;
    const thumbDest = path.join(opts.thumbsDir, thumbName);
    // 同名不同码点视为冲突：目标已存在即中止该项（已注册的不会走到这里）
    if (fs.existsSync(copyDest)) { errors.push(red(`  ✗ ${file}: 目标已存在 ${copyDest}（同名/码点冲突），中止该项`)); continue; }
    if (fs.existsSync(thumbDest)) { errors.push(red(`  ✗ ${file}: 缩略图已存在 ${thumbDest}（slug 冲突?），中止该项`)); continue; }

    plans.push({
      file, srcPath, copyDest, thumbDest, thumbName, slug,
      title: makeTitle(stem),
      date, needsManualId,
      insertLine: `  { id: ${tsStr(slug)}, title: ${tsStr(makeTitle(stem))}, image: ${tsStr(`/images/portfolio/${file}`)}, thumb: ${tsStr(`/images/portfolio-thumbs/${thumbName}`)}, date: ${tsStr(date)} },`,
    });
  }
  for (const e of errors) console.log(e);
  if (plans.length === 0 && errors.length > 0) { console.error(red('\n全部新作品均存在冲突，未做任何改动。')); process.exit(1); }

  // 5. 预览 / 执行
  console.log(bold('\n将执行的动作:'));
  for (const p of plans) {
    console.log(`  ${cyan('copy')}  ${p.srcPath}\n        -> ${p.copyDest}`);
    console.log(`  ${cyan('thumb')} ffmpeg ${THUMB_W}x${THUMB_H} webp q${THUMB_Q} -> ${p.thumbDest}`);
    console.log(`  ${cyan('insert')} 置顶到 portfolioWorks 数组开头:`);
    console.log(gray(`        ${p.insertLine}`));
    if (p.needsManualId) {
      console.log(yellow(`        ⚠ 纯 CJK 文件名：现有惯例 id 为人工语义英译（如 晚餐見→dinner-view）；已用占位 id "${p.slug}"，建议接入后人工改 id+thumb（#62 惯例）。`));
    }
  }

  if (opts.dryRun) {
    console.log(green(`\n[dry-run] 预览结束，零写入。新增 ${plans.length} 张 / skipped ${skipped.length} 张 / psd 待导出 ${orphanPsds.length} 个。`));
    return;
  }

  // 6. 实跑：copy → thumb → insert
  const done = [];
  const failed = [];
  fs.mkdirSync(opts.publicDir, { recursive: true });
  fs.mkdirSync(opts.thumbsDir, { recursive: true });

  let registryText = reg.text;
  let registryDirty = false;

  for (const p of plans) {
    try {
      // 幂等双保险：插入前再确认注册表不含该文件名
      if (nfc(registryText).includes(nfc(p.file)) && registryText.includes(`/images/portfolio/${p.file}`)) {
        console.log(yellow(`  skipped（运行中已注册）: ${p.file}`));
        continue;
      }
      // copy 原图
      fs.copyFileSync(p.srcPath, p.copyDest);
      // ffmpeg 缩略图（#42 参数）
      const args = [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', p.srcPath,
        '-vf', `scale=${THUMB_W}:${THUMB_H}:force_original_aspect_ratio=increase,crop=${THUMB_W}:${THUMB_H}`,
        '-frames:v', '1',
        '-c:v', 'libwebp', '-q:v', String(THUMB_Q),
        p.thumbDest,
      ];
      const r = spawnSync(ffmpeg, args, { encoding: 'utf8', shell: false });
      if (r.status !== 0 || !fs.existsSync(p.thumbDest)) {
        throw new Error(`ffmpeg exit ${r.status}: ${String(r.stderr || '').trim().slice(0, 200)}`);
      }
      // 置顶插入注册条目（锚点: 数组开头的 `[`）
      const anchor = 'portfolioWorks: PortfolioWork[] = [';
      const idx = registryText.indexOf(anchor);
      if (idx === -1) throw new Error('注册表锚点丢失（portfolioWorks 数组声明未找到）');
      const at = idx + anchor.length;
      registryText = registryText.slice(0, at) + reg.eol + p.insertLine + registryText.slice(at);
      registryDirty = true;
      const kb = (fs.statSync(p.thumbDest).size / 1024).toFixed(1);
      console.log(green(`  ✓ ${p.file} → id=${p.slug}（thumb ${kb} KB）`));
      done.push(p);
    } catch (err) {
      failed.push(`${p.file}（${err.message}）`);
      console.error(red(`  ✗ ${p.file}: ${err.message}`));
      // 回滚该项已产生的部分产物，保持一致性
      try { if (fs.existsSync(p.copyDest)) fs.unlinkSync(p.copyDest); } catch {}
      try { if (fs.existsSync(p.thumbDest)) fs.unlinkSync(p.thumbDest); } catch {}
    }
  }

  // 7. 写回注册表（仅在确有插入时）
  if (registryDirty) {
    if (!registryText.includes('export const portfolioWorks')) throw new Error('写回前校验失败');
    fs.writeFileSync(opts.registry, registryText, 'utf8');
    console.log(green(`\n注册表已更新: ${opts.registry}（置顶插入 ${done.length} 条）`));
  }

  // 8. 汇总报告
  console.log(bold('\n──────── 报告 ────────'));
  console.log(`新增接入: ${green(String(done.length))} 张  /  skipped: ${skipped.length} 张  /  失败: ${failed.length} 张  /  psd 待导出: ${orphanPsds.length} 个`);
  for (const f of failed) console.log(red(`  失败: ${f}`));
  if (done.length > 0) {
    console.log('\n后续步骤: npx tsc --noEmit → npx next dev 验证三处展示 → npx next build → commit → push');
  }
  if (failed.length > 0) process.exit(1);
}

main();
