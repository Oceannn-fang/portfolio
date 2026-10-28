/**
 * 诊断：子进程 spawn 在本沙箱中到底卡在哪种 stdio 配置上
 * 每个变体单独跑，2 秒内未报错即视为成功。
 */
const { spawn, fork } = require('node:child_process');
const path = require('node:path');

const results = [];

function probe(label, factory) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (outcome) => {
      if (settled) return;
      settled = true;
      results.push({ label, outcome });
      resolve();
    };
    try {
      const child = factory();
      child.on('error', (err) => done(`FAIL ${err.code || err.message}`));
      child.on('exit', () => done('OK (exited)'));
      setTimeout(() => {
        try {
          child.kill();
        } catch {
          /* 忽略 */
        }
        done('OK (still running, 2s)');
      }, 2000);
    } catch (err) {
      done(`THROW ${err.code || err.message}`);
    }
  });
}

(async () => {
  const worker = path.join(__dirname, 'spawn-probe-worker.cjs');
  const c = ['cmd', ['/c', 'echo probe']];

  await probe('stdio: pipe', () => spawn(c[0], c[1], { stdio: 'pipe' }));
  await probe('stdio: inherit', () => spawn(c[0], c[1], { stdio: 'inherit' }));
  await probe('stdio: ignore', () => spawn(c[0], c[1], { stdio: 'ignore' }));
  await probe('stdio: [ignore,inherit,inherit]', () => spawn(c[0], c[1], { stdio: ['ignore', 'inherit', 'inherit'] }));
  await probe('stdio: [pipe,pipe,pipe]', () => spawn(c[0], c[1], { stdio: ['pipe', 'pipe', 'pipe'] }));
  await probe('fork (ipc)', () => fork(worker, { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] }));
  await probe('fork (default)', () => fork(worker));

  console.log('\n=== 诊断结果 ===');
  for (const r of results) console.log(`  ${r.label.padEnd(34)} ${r.outcome}`);
})();
