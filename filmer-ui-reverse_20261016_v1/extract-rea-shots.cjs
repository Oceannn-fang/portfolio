/**
 * 从 REA capture_browser_scenario 的 spill 文件里提取内联 PNG 截图
 * 用法：node extract-rea-shots.cjs <spillTxtPath> <outDir>
 */
const fs = require('node:fs');
const path = require('node:path');

const spill = process.argv[2];
const outDir = process.argv[3];
fs.mkdirSync(outDir, { recursive: true });

const raw = fs.readFileSync(spill, 'utf-8');
const saved = [];

// 优先按 JSON 解析（若能解析）；否则退回正则配对 step_id 与紧随其后的 data_base64
let parsed = null;
try {
  parsed = JSON.parse(raw);
} catch {
  parsed = null;
}

if (parsed && parsed.normalized_result && Array.isArray(parsed.normalized_result.steps)) {
  for (const step of parsed.normalized_result.steps) {
    const shot = step.artifacts && step.artifacts.screenshot;
    if (shot && shot.state === 'captured' && shot.value && shot.value.data_base64) {
      const file = path.join(outDir, `rea-${String(step.step_index).padStart(2, '0')}-${step.step_id}.png`);
      fs.writeFileSync(file, Buffer.from(shot.value.data_base64, 'base64'));
      saved.push({ step: step.step_id, file, bytes: shot.value.bytes, sha256: shot.value.sha256 });
    }
  }
} else {
  const re = /"step_id":"([^"]+)"[\s\S]*?"data_base64":"([A-Za-z0-9+/=]+)"/g;
  let m;
  let i = 0;
  while ((m = re.exec(raw)) !== null) {
    const file = path.join(outDir, `rea-${String(i++).padStart(2, '0')}-${m[1]}.png`);
    fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
    saved.push({ step: m[1], file, bytes: Buffer.from(m[2], 'base64').length });
  }
}

console.log(JSON.stringify(saved, null, 2));
console.log(`共提取 ${saved.length} 张`);
process.exit(saved.length ? 0 : 1);
