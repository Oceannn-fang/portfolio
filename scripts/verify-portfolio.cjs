(async () => {
const { chromium } = require("playwright");
const fs = require("node:fs");

const BASE = "http://localhost:3100";
const OUT_DIR = process.env.GK3_OUT_DIR || "C:/Users/86185/OneDrive/文档/portfolio/.gk3-verify";

fs.mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
});

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` :: ${detail}` : ""}`);
};

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const consoleErrors = [];
desktop.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
desktop.on("pageerror", (error) => consoleErrors.push(error.message));

await desktop.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
await desktop.waitForTimeout(4500);

const pageTitle = await desktop.title();
check("title is Fang", pageTitle.includes("Fang") && pageTitle.includes("方"), pageTitle);
const meta = await desktop.evaluate(() => ({
  description: document.querySelector('meta[name="description"]')?.content,
  ogTitle: document.querySelector('meta[property="og:title"]')?.content,
  theme: document.querySelector('meta[name="theme-color"]')?.content,
}));
check("description is personal", Boolean(meta.description && !meta.description.includes("George")), meta.description);
check("og title is personal", Boolean(meta.ogTitle && !meta.ogTitle.includes("George")), meta.ogTitle);
check("theme color uses gk3 palette", /^rgb\(/.test(meta.theme ?? "") && meta.theme !== "rgb(30, 30, 30)", meta.theme);

const initial = await desktop.evaluate(() => {
  const rows = [...document.querySelectorAll("#main > .row")];
  const brokenImages = [...document.images]
    .filter((img) => img.getAttribute("src") && (!img.complete || img.naturalWidth === 0))
    .map((img) => img.getAttribute("src"));
  const rootStyle = getComputedStyle(document.documentElement);
  return {
    rows: rows.map((row) => row.className),
    selectedWorks: document.querySelectorAll("#main > .row:nth-child(2) .work li").length,
    listeningOrbitItems: document.querySelectorAll("#main > .row:nth-child(4) .orbit-item").length,
    listeningChips: document.querySelectorAll("#main > .row:nth-child(4) .track-album-chip").length,
    portfolioCards: document.querySelectorAll(".portfolio-card").length,
    albumChips: document.querySelectorAll(".track-album-chip").length,
    viewerClass: document.querySelector("#viewer")?.className,
    bodyViewing: document.body.classList.contains("viewing"),
    fg: rootStyle.getPropertyValue("--fg-color").trim(),
    bg: rootStyle.getPropertyValue("--bg-color").trim(),
    accent: rootStyle.getPropertyValue("--accent").trim(),
    noiseExists: Boolean(document.querySelector("#noise")),
    rootBackground: getComputedStyle(document.documentElement).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    hero: (() => {
      const hero = document.querySelector("#hero");
      return hero
        ? {
            heroInner: Boolean(hero.querySelector("#hero-inner")),
            abletonTransport: Boolean(document.querySelector(".ableton-transport")),
            copy: hero.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() || "",
          }
        : null;
    })(),
    brokenImages,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  };
});
check("row count and order", JSON.stringify(initial.rows) === JSON.stringify(["row", "row rich-row", "row rich-row", "row", "row bar", "row legal"]), initial.rows.join(" | "));
check("selected works shows four", initial.selectedWorks === 4, `count=${initial.selectedWorks}`);
check("listening combines orbit and tracklists", initial.listeningOrbitItems > 0 && initial.listeningChips > 0, `orbit=${initial.listeningOrbitItems}, chips=${initial.listeningChips}`);
check("portfolio stack renders", initial.portfolioCards >= 5, `cards=${initial.portfolioCards}`);
check("album tracklist renders", initial.albumChips > 0, `chips=${initial.albumChips}`);
check("viewer starts closed", initial.viewerClass === "phone" && !initial.bodyViewing, initial.viewerClass);
check("hero colors removed ableton palette", initial.fg !== "rgb(224, 224, 224)" && initial.bg !== "rgb(30, 30, 30)" && initial.accent !== "#f0a030", JSON.stringify({ fg: initial.fg, bg: initial.bg, accent: initial.accent }));
check("noise overlay removed", !initial.noiseExists);
check("background and text use gk3 palette", initial.rootBackground !== "rgb(30, 30, 30)" && initial.bodyColor !== "rgb(224, 224, 224)", `${initial.rootBackground} / ${initial.bodyColor}`);
check("gk3 hero renders", Boolean(initial.hero?.heroInner && !initial.hero.abletonTransport && initial.hero.copy.includes("Fang") && initial.hero.copy.includes("方")), JSON.stringify(initial.hero));
check("no broken images", initial.brokenImages.length === 0, initial.brokenImages.join(","));
check("no desktop horizontal overflow", initial.scrollWidth <= initial.innerWidth, `scroll=${initial.scrollWidth}, inner=${initial.innerWidth}`);
check("no console errors", consoleErrors.length === 0, consoleErrors.join(" | "));

const orbitRendered = await desktop.evaluate(() => ({
  itemCount: document.querySelectorAll(".orbit-item").length,
  imageCount: document.querySelectorAll(".orbit-image").length,
  centerText: document.querySelector(".orbit-center-content")?.textContent?.trim() || "",
}));
check("album orbit renders", orbitRendered.itemCount > 0 && orbitRendered.imageCount > 0, `items=${orbitRendered.itemCount}, images=${orbitRendered.imageCount}`);
check("orbit center is ready", orbitRendered.centerText.length > 0, orbitRendered.centerText);

const listeningLayout = await desktop.evaluate(() => {
  const orbit = document.querySelector(".listening-orbit");
  return {
    orbitContained: Boolean(orbit && orbit.scrollWidth <= orbit.clientWidth + 1),
    chipCount: document.querySelectorAll(".track-chip-name").length,
  };
});
check("orbit internal overflow contained", listeningLayout.orbitContained, JSON.stringify(listeningLayout));

const autoStart = await desktop.evaluate(() => document.querySelector(".portfolio-card.is-active h3")?.textContent?.trim() || "");
await desktop.waitForTimeout(5600);
const autoNext = await desktop.evaluate(() => document.querySelector(".portfolio-card.is-active h3")?.textContent?.trim() || "");
check("portfolio auto advances", autoStart.length > 0 && autoStart !== autoNext, `${autoStart} -> ${autoNext}`);
await desktop.locator(".portfolio-card.is-active").click();
await desktop.waitForTimeout(600);
const drawerState = await desktop.evaluate(() => ({
  open: Boolean(document.querySelector(".portfolio-drawer")),
  panel: Boolean(document.querySelector(".portfolio-drawer-panel")),
  title: document.querySelector(".portfolio-drawer-copy h2")?.textContent || "",
}));
check("portfolio click opens drawer", drawerState.open && drawerState.panel && Boolean(drawerState.title), drawerState.title);
await desktop.keyboard.press("Escape");
await desktop.waitForTimeout(500);
const drawerClosed = await desktop.evaluate(() => !document.querySelector(".portfolio-drawer"));
check("esc closes drawer", drawerClosed);

const orbitTarget = desktop.locator(".orbit-item").first();
await orbitTarget.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
await orbitTarget.evaluate((el) => el.dispatchEvent(new MouseEvent("click", { bubbles: true })));
await desktop.waitForTimeout(450);
const orbitClicked = await desktop.evaluate(() => ({
  centerText: document.querySelector(".orbit-center-content")?.textContent?.trim() || "",
}));
check("orbit click reveals album", orbitClicked.centerText.length > 0 && !orbitClicked.centerText.toLowerCase().includes("hover to reveal"), orbitClicked.centerText);

await desktop.locator("#main > .row:nth-child(2) .work li").first().hover();
await desktop.waitForTimeout(600);
const hoverState = await desktop.evaluate(() => ({
  bodyViewing: document.body.classList.contains("viewing"),
  viewerClass: document.querySelector("#viewer")?.className,
  imageDisplay: getComputedStyle(document.querySelector("#viewerImage")).display,
  imageSrc: document.querySelector("#viewerImage")?.getAttribute("src"),
}));
check("hover opens image viewer", hoverState.bodyViewing && hoverState.viewerClass.includes("image"), hoverState.viewerClass);
check("viewer image becomes visible", hoverState.imageDisplay === "block" && Boolean(hoverState.imageSrc), hoverState.imageSrc);

await desktop.mouse.move(8, 8);
await desktop.waitForTimeout(400);
await desktop.locator(".track-album-chip").first().scrollIntoViewIfNeeded();
await desktop.locator(".track-album-chip").first().click();
await desktop.waitForTimeout(700);
const trackState = await desktop.evaluate(() => ({
  expanded: Boolean(document.querySelector(".track-expanded")),
  expandedName: document.querySelector(".track-expanded-name")?.textContent,
  spotifyHref: document.querySelector(".track-spotify-btn")?.getAttribute("href"),
}));
check("album click expands tracklist", trackState.expanded && Boolean(trackState.expandedName), trackState.expandedName);
check("spotify button present", Boolean(trackState.spotifyHref), trackState.spotifyHref);

await desktop.screenshot({ path: `${OUT_DIR}/portfolio-desktop.png`, fullPage: true });

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const mobileErrors = [];
phone.on("console", (message) => {
  if (message.type() === "error") mobileErrors.push(message.text());
});
phone.on("pageerror", (error) => mobileErrors.push(error.message));
await phone.goto(BASE, { waitUntil: "domcontentloaded", timeout: 30000 });
await phone.waitForTimeout(4500);

const mobileBefore = await phone.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
  viewerHitExists: Boolean(document.querySelector("#viewerHit")),
  viewerHitDisplay: document.querySelector("#viewerHit")
    ? getComputedStyle(document.querySelector("#viewerHit")).display
    : null,
  portfolioWidth: document.querySelector(".portfolio-stack")?.getBoundingClientRect().width,
  bodyWidth: document.body.getBoundingClientRect().width,
}));
check("no mobile horizontal overflow", mobileBefore.scrollWidth <= mobileBefore.innerWidth, JSON.stringify(mobileBefore));
check("mobile viewer hit control visible", mobileBefore.viewerHitExists && mobileBefore.viewerHitDisplay === "block", `${mobileBefore.viewerHitExists} / ${mobileBefore.viewerHitDisplay}`);

const mobileTarget = phone.locator("#main > .row:nth-child(2) .work li").first();
await mobileTarget.scrollIntoViewIfNeeded();
await phone.waitForTimeout(300);
const mobileBox = await mobileTarget.boundingBox();
if (mobileBox) {
  await phone.touchscreen.tap(mobileBox.x + mobileBox.width / 2, mobileBox.y + mobileBox.height / 2);
}
await phone.waitForTimeout(900);
const mobileTap = await phone.evaluate(() => ({
  bodyViewing: document.body.classList.contains("viewing"),
  viewerClass: document.querySelector("#viewer")?.className,
  imageDisplay: getComputedStyle(document.querySelector("#viewerImage")).display,
  imageSrc: document.querySelector("#viewerImage")?.getAttribute("src"),
}));
check("mobile tap opens image viewer", mobileTap.bodyViewing && mobileTap.viewerClass.includes("image"), mobileTap.viewerClass);
check("mobile viewer image visible", mobileTap.imageDisplay === "block" && Boolean(mobileTap.imageSrc), mobileTap.imageSrc);

await phone.evaluate(() => window.scrollTo(0, 320));
await phone.waitForTimeout(600);
await phone.screenshot({ path: `${OUT_DIR}/portfolio-mobile.png`, fullPage: true });
check("no mobile console errors", mobileErrors.length === 0, mobileErrors.join(" | "));

await browser.close();

const failed = results.filter((result) => !result.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);

})();
