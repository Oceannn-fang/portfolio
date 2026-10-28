/** 诊断：向已存在的 9222 会话发几条带超时的 CDP 命令，定位卡点 */
(async () => {
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  console.log('targets:', list.map((t) => `${t.type}:${String(t.url).slice(0, 60)}`).join(' | '));
  const page = list.find((t) => t.type === 'page');
  if (!page) {
    console.log('no page target');
    process.exit(0);
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('ws error')), { once: true });
    setTimeout(() => rej(new Error('ws open timeout')), 5000);
  }).catch((e) => {
    console.log('WS FAIL:', e.message);
    process.exit(0);
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  });
  const send = (method, params = {}, ms = 4000) =>
    new Promise((resolve) => {
      const i = ++id;
      pending.set(i, resolve);
      ws.send(JSON.stringify({ id: i, method, params }));
      setTimeout(() => resolve({ TIMEOUT: true, method }), ms);
    });

  const t = (label, r) => console.log(`${label}: ${JSON.stringify(r).slice(0, 200)}`);
  t('Runtime.evaluate 1+1', await send('Runtime.evaluate', { expression: '1+1', returnByValue: true }));
  t('fallback count', await send('Runtime.evaluate', { expression: 'document.querySelectorAll(".mm-embed-fallback").length', returnByValue: true }));
  t('iframe count', await send('Runtime.evaluate', { expression: 'document.querySelectorAll(".mm-embed iframe").length', returnByValue: true }));
  t('Page.captureScreenshot', await send('Page.captureScreenshot', { format: 'jpeg', quality: 40 }, 6000));
  t('DOM.getDocument', await send('DOM.getDocument', {}, 4000));
  process.exit(0);
})();
