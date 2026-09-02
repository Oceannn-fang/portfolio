const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const BASE = process.argv[2] || "http://localhost:3100";
const profile = path.join(os.tmpdir(), `gk3-cdp-${Date.now()}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.consoleErrors = [];

    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
        return;
      }
      if (!message.method) return;
      const handlers = this.listeners.get(message.method) || [];
      for (const handler of handlers) handler(message.params);

      if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        this.consoleErrors.push(
          message.params.args
            .map((arg) => arg.value ?? arg.description ?? "")
            .join(" ")
        );
      }
      if (message.method === "Runtime.exceptionThrown") {
        const details = message.params.exceptionDetails;
        this.consoleErrors.push(details.exception?.description || details.text || "Runtime exception");
      }
      if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
        this.consoleErrors.push(message.params.entry.text);
      }
    });
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, fn) {
    const handler = (params) => {
      this.off(method, handler);
      fn(params);
    };
    this.on(method, handler);
  }

  on(method, fn) {
    const handlers = this.listeners.get(method) || [];
    handlers.push(fn);
    this.listeners.set(method, handlers);
  }

  off(method, fn) {
    const handlers = this.listeners.get(method) || [];
    this.listeners.set(
      method,
      handlers.filter((handler) => handler !== fn)
    );
  }

  close() {
    this.ws.close();
  }
}

function waitForChromeDebugUrl(chrome) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Chrome CDP startup timed out")), 20000);
    chrome.stderr.setEncoding("utf8");
    chrome.stderr.on("data", (chunk) => {
      const match = chunk.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    chrome.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited with code ${code}`));
    });
  });
}

async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Evaluation failed");
  }
  return response.result.value;
}

async function main() {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--no-sandbox",
      "--hide-scrollbars",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] }
  );

  const browserWs = await waitForChromeDebugUrl(chrome);
  const port = new URL(browserWs).port;
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(BASE)}`, {
    method: "PUT",
  }).then((response) => response.json());

  const cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const load = new Promise((resolve) => cdp.once("Page.loadEventFired", resolve));
  await cdp.send("Page.navigate", { url: BASE });
  await Promise.race([load, sleep(15000)]);
  await sleep(4500);

  const desktopExpression = `(() => {
    const rows = [...document.querySelectorAll("#main > .row")];
    const hero = document.querySelector("#hero h1");
    const brokenImages = [...document.images]
      .filter((img) => img.getAttribute("src") && (!img.complete || img.naturalWidth === 0))
      .map((img) => img.getAttribute("src"));
    return {
      title: document.title,
      hero: hero ? hero.textContent.replace(/\\s+/g, " ").trim() : "",
      noise: Boolean(document.querySelector("#noise")),
      abletonTransport: Boolean(document.querySelector(".ableton-transport")),
      rows: rows.map((row) => row.className),
      selectedWorks: document.querySelectorAll("#main > .row:nth-child(2) .work li").length,
      portfolioCards: document.querySelectorAll(".portfolio-card").length,
      orbitItems: document.querySelectorAll(".orbit-item").length,
      trackChips: document.querySelectorAll(".track-album-chip").length,
      fg: getComputedStyle(document.documentElement).getPropertyValue("--fg-color").trim(),
      bg: getComputedStyle(document.documentElement).getPropertyValue("--bg-color").trim(),
      brokenImages,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      viewerClass: document.querySelector("#viewer")?.className || "",
      bodyViewing: document.body.classList.contains("viewing"),
    };
  })()`;

  const desktop = await evaluate(cdp, desktopExpression);
  const desktopPass =
    desktop.title.includes("Fang") &&
    desktop.hero.includes("Fang") &&
    desktop.hero.includes("方") &&
    !desktop.noise &&
    !desktop.abletonTransport &&
    desktop.portfolioCards > 0 &&
    desktop.orbitItems > 0 &&
    desktop.trackChips > 0 &&
    desktop.scrollWidth <= desktop.innerWidth &&
    !desktop.brokenImages.length;

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  await sleep(2500);

  const mobileExpression = `(() => {
    const viewerHit = document.querySelector("#viewerHit");
    const stack = document.querySelector(".portfolio-stack");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      viewerHitDisplay: viewerHit ? getComputedStyle(viewerHit).display : null,
      portfolioWidth: stack ? Math.round(stack.getBoundingClientRect().width) : 0,
      bodyWidth: Math.round(document.body.getBoundingClientRect().width),
    };
  })()`;

  const mobile = await evaluate(cdp, mobileExpression);
  const mobilePass =
    mobile.scrollWidth <= mobile.innerWidth &&
    mobile.viewerHitDisplay === "block" &&
    mobile.portfolioWidth > 0;

  console.log(
    JSON.stringify(
      {
        desktop,
        desktopPass,
        mobile,
        mobilePass,
        consoleErrors: cdp.consoleErrors,
      },
      null,
      2
    )
  );

  cdp.close();
  chrome.kill();
  await new Promise((resolve) => {
    if (chrome.exitCode !== null) resolve();
    else chrome.once("exit", resolve);
  });
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome may still hold the profile for a moment on Windows.
  }

  if (!desktopPass || !mobilePass || cdp.consoleErrors.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
