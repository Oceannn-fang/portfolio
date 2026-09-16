import * as THREE from 'three';

const albums = [
  { artist: "The Beatles", title: "Abbey Road", file: "album_covers/01_the_beatles_abbey_road_2019_mix.jpg" },
  { artist: "Pink Floyd", title: "The Dark Side of the Moon", file: "album_covers/02_pink_floyd_the_dark_side_of_the_moon.jpg" },
  { artist: "Nirvana", title: "Nevermind", file: "album_covers/03_nirvana_nevermind.jpg" },
  { artist: "Michael Jackson", title: "Thriller", file: "album_covers/04_michael_jackson_thriller.jpg" },
  { artist: "Fleetwood Mac", title: "Rumours", file: "album_covers/05_fleetwood_mac_rumours.jpg" },
  { artist: "David Bowie", title: "Ziggy Stardust", file: "album_covers/06_david_bowie_the_rise_and_fall_of_ziggy_stardust_and_the_spiders_from_mars_2012_remaster.jpg" },
  { artist: "The Velvet Underground", title: "The Velvet Underground & Nico", file: "album_covers/07_the_velvet_underground_and_nico_the_velvet_underground_and_nico_45th_anniversary_edition.jpg" },
  { artist: "Radiohead", title: "OK Computer", file: "album_covers/08_radiohead_ok_computer.jpg" },
  { artist: "Prince & The Revolution", title: "Purple Rain", file: "album_covers/09_prince_and_the_revolution_purple_rain.jpg" },
  { artist: "Kanye West", title: "My Beautiful Dark Twisted Fantasy", file: "album_covers/10_kanye_west_my_beautiful_dark_twisted_fantasy.jpg" },
  { artist: "Kendrick Lamar", title: "good kid, m.A.A.d city", file: "album_covers/11_kendrick_lamar_good_kid_m_a_a_d_city.jpg" },
  { artist: "Lauryn Hill", title: "The Miseducation of Lauryn Hill", file: "album_covers/12_lauryn_hill_the_miseducation_of_lauryn_hill.jpg" },
  { artist: "Miles Davis", title: "Kind of Blue", file: "album_covers/13_miles_davis_kind_of_blue.jpg" },
  { artist: "John Coltrane", title: "A Love Supreme", file: "album_covers/14_john_coltrane_a_love_supreme.jpg" },
  { artist: "Daft Punk", title: "Discovery", file: "album_covers/15_daft_punk_discovery.jpg" },
  { artist: "Beyonce", title: "Lemonade", file: "album_covers/16_beyonc_lemonade.jpg" },
  { artist: "Taylor Swift", title: "1989", file: "album_covers/17_taylor_swift_1989.jpg" },
  { artist: "Billie Eilish", title: "When We All Fall Asleep, Where Do We Go?", file: "album_covers/18_billie_eilish_when_we_all_fall_asleep_where_do_we_go.jpg" },
  { artist: "Amy Winehouse", title: "Back to Black", file: "album_covers/19_amy_winehouse_back_to_black.jpg" },
  { artist: "Adele", title: "21", file: "album_covers/20_adele_21.jpg" },
  { artist: "Arctic Monkeys", title: "AM", file: "album_covers/21_arctic_monkeys_am.jpg" },
  { artist: "The Strokes", title: "Is This It", file: "album_covers/22_the_strokes_is_this_it.jpg" },
  { artist: "The Clash", title: "London Calling", file: "album_covers/23_the_clash_london_calling_expanded_edition.jpg" },
  { artist: "Joy Division", title: "Unknown Pleasures", file: "album_covers/24_joy_division_unknown_pleasures_2019_digital_master.jpg" },
  { artist: "Metallica", title: "Master of Puppets", file: "album_covers/25_metallica_master_of_puppets_expanded_edition.jpg" },
  { artist: "AC/DC", title: "Back In Black", file: "album_covers/26_ac_dc_back_in_black.jpg" },
  { artist: "Bob Dylan", title: "Highway 61 Revisited", file: "album_covers/27_bob_dylan_highway_61_revisited.jpg" },
  { artist: "Joni Mitchell", title: "Blue", file: "album_covers/28_joni_mitchell_blue.jpg" },
  { artist: "Marvin Gaye", title: "What's Going On", file: "album_covers/29_marvin_gaye_what_s_going_on.jpg" },
  { artist: "Stevie Wonder", title: "Songs in the Key of Life", file: "album_covers/30_stevie_wonder_songs_in_the_key_of_life.jpg" },
];

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const topLayer = document.querySelector(".arc-layer-top");
const bottomLayer = document.querySelector(".arc-layer-bottom");
const focus = document.querySelector(".focus");
const focusCover = document.querySelector(".focus-cover");
const focusImage = document.querySelector(".focus-cover-image");
const playButton = document.querySelector(".play-button");
const playLabel = document.querySelector(".play-label");
const previewAudio = document.querySelector(".preview-audio");
previewAudio.volume = 0.92;
window.previewAudio = previewAudio;

let scene, camera, renderer;
let cdMeshes = new Map();
let focusMesh = null;
let selectedAlbum = albums[0];
let lastTime = performance.now();
let previewPlaying = false;
let previewTransitioning = false;
let audioFadeFrame = 0;
let audioFadeToken = 0;
let previewSession = 0;
let selectionTransitionId = 0;
let activeSelectionFlight = null;

const PREVIEW_VOLUME = 0.92;
const DUCKED_VOLUME = 0.12;
const PREVIEW_DUCK_MS = 460;
const PREVIEW_FADE_IN_MS = 820;
const FOCUS_SWAP_DELAY_MS = 820;
const CARD_STACK_MIN_Z = 0.16;
const CARD_STACK_RANGE_Z = 4.3;
const FOCUS_STACK_Z = 4.9;
const HOVER_Y_SHIFT = 10;
const CASE_DEPTH_RATIO = 0.155;
const FOCUS_INTERACTION_RANGE = 1.65;
const IDLE_DRIFT_CHANGE_MIN_MS = 1350;
const IDLE_DRIFT_CHANGE_RANGE_MS = 2300;

const lanes = [
  {
    name: "top",
    el: topLayer,
    albums: albums.slice(0, 18),
    direction: 1,
    offset: 0.03,
    speed: 0.000018,
    targetSpeed: 0.000018,
    normalSpeed: 0.000018,
    hoverSpeed: 0.0000038,
    slowUntil: 0,
    cards: [],
  },
  {
    name: "bottom",
    el: bottomLayer,
    albums: albums.slice(12, 30),
    direction: -1,
    offset: 0.72,
    speed: 0.000015,
    targetSpeed: 0.000015,
    normalSpeed: 0.000015,
    hoverSpeed: 0.000003,
    slowUntil: 0,
    cards: [],
  },
];

const pointer = {
  targetX: 0, targetY: 0, x: 0, y: 0,
  targetScale: 1, scale: 1,
  shineX: 50, shineY: 42,
  clientX: -9999, clientY: -9999,
  inFocusRange: false,
  targetTiltX: 0, targetTiltY: 0, targetTiltRx: 0, targetTiltRy: 0, targetRoll: 0,
  tiltX: 0, tiltY: 0, tiltRx: 0, tiltRy: 0, roll: 0,
};

const idleMotion = {
  phase: Math.random() * Math.PI * 2,
  nextChangeAt: 0,
  x: 0, y: 0, tiltRx: 0, tiltRy: 0, roll: 0,
  targetX: 0, targetY: 0, targetTiltRx: 0, targetTiltRy: 0, targetRoll: 0,
};

function initThreeJS() {
  const canvas = document.getElementById('three-canvas');
  
  scene = new THREE.Scene();
  
  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 10);
  
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  
  const key = new THREE.DirectionalLight(0xfff5e6, 1.2);
  key.position.set(5, 5, 5);
  scene.add(key);
  
  const fill = new THREE.DirectionalLight(0xb0c4de, 0.4);
  fill.position.set(-3, 2, 3);
  scene.add(fill);
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function extractColors(image) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const s = 64;
  canvas.width = s;
  canvas.height = s;
  ctx.drawImage(image, 0, 0, s, s);

  const imageData = ctx.getImageData(0, 0, s, s).data;
  const band = 12;
  const primary = dominantColor(imageData, s, 0, 0, s, s);
  const left = normalizeDisplayColor(dominantColor(imageData, s, 0, 0, s / 2, s));
  const right = normalizeDisplayColor(dominantColor(imageData, s, s / 2, 0, s / 2, s));
  const top = dominantColor(imageData, s, 0, 0, s, band);
  const bottom = dominantColor(imageData, s, 0, s - band, s, band);
  const topBottom = normalizeDisplayColor(mixColors(top, bottom, 0.5));
  const complement = normalizeDisplayColor(rotateHue(primary, 180));
  const rare = rareAccentColor(imageData, s, primary);
  const edgeAccent = normalizeDisplayColor(mixColors(rare, complement, 0.42));
  const edgeAccentAlt = normalizeDisplayColor(mixColors(edgeAccent, adjustColor(complement, 0.78, 22), 0.32));
  const brightness = getBrightness(primary);

  const dark = brightness > 128
    ? adjustColor(primary, 0.25)
    : adjustColor(primary, 0.4);
  const light = brightness > 128
    ? adjustColor(primary, 0.85)
    : adjustColor(primary, 1.4, 40);

  return {
    primary,
    sideLeft: left,
    sideRight: right,
    sideTopBottom: topBottom,
    edgeAccent,
    edgeAccentAlt,
    dark, light,
    textColor: getReadableTextColor(primary),
    brightness,
  };
}

function collectColorBuckets(data, size, x0, y0, width, height) {
  const buckets = new Map();
  const startX = Math.max(0, Math.floor(x0));
  const startY = Math.max(0, Math.floor(y0));
  const endX = Math.min(size, Math.ceil(x0 + width));
  const endY = Math.min(size, Math.ceil(y0 + height));

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * size + x) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;
      const brightness = getBrightness({ r, g, b });
      const weight = 1 + saturation * 2.4 + (brightness > 28 && brightness < 238 ? 0.8 : 0);
      const key = `${Math.round(r / 24)},${Math.round(g / 24)},${Math.round(b / 24)}`;
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, weight: 0, count: 0 };

      bucket.r += r * weight;
      bucket.g += g * weight;
      bucket.b += b * weight;
      bucket.weight += weight;
      bucket.count += 1;
      buckets.set(key, bucket);
    }
  }

  return Array.from(buckets.values()).map((bucket) => {
    const color = {
      r: clampChannel(bucket.r / bucket.weight),
      g: clampChannel(bucket.g / bucket.weight),
      b: clampChannel(bucket.b / bucket.weight),
    };
    const max = Math.max(color.r, color.g, color.b);
    const min = Math.min(color.r, color.g, color.b);
    return {
      ...color,
      weight: bucket.weight,
      count: bucket.count,
      saturation: max === 0 ? 0 : (max - min) / max,
      brightness: getBrightness(color),
    };
  });
}

function dominantColor(data, size, x0, y0, width, height) {
  const buckets = collectColorBuckets(data, size, x0, y0, width, height);
  const winner = buckets.reduce((best, bucket) => (
    !best || bucket.weight > best.weight ? bucket : best
  ), null);
  return winner || { r: 128, g: 128, b: 128 };
}

function clampChannel(value) {
  return Math.min(255, Math.max(0, Math.round(value)));
}

function getBrightness(color) {
  return (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
}

function adjustColor(color, scale, offset = 0) {
  return {
    r: clampChannel(color.r * scale + offset),
    g: clampChannel(color.g * scale + offset),
    b: clampChannel(color.b * scale + offset),
  };
}

function mixColors(a, b, weight = 0.5) {
  return {
    r: clampChannel(a.r * (1 - weight) + b.r * weight),
    g: clampChannel(a.g * (1 - weight) + b.g * weight),
    b: clampChannel(a.b * (1 - weight) + b.b * weight),
  };
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

function rgbToHsl(color) {
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (max === g) h = (b - r) / d + 2;
    if (max === b) h = (r - g) / d + 4;
    h /= 6;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }) {
  const hueToRgb = (p, q, t) => {
    let nextT = t;
    if (nextT < 0) nextT += 1;
    if (nextT > 1) nextT -= 1;
    if (nextT < 1 / 6) return p + (q - p) * 6 * nextT;
    if (nextT < 1 / 2) return q;
    if (nextT < 2 / 3) return p + (q - p) * (2 / 3 - nextT) * 6;
    return p;
  };

  if (s === 0) {
    const channel = clampChannel(l * 255);
    return { r: channel, g: channel, b: channel };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: clampChannel(hueToRgb(p, q, h + 1 / 3) * 255),
    g: clampChannel(hueToRgb(p, q, h) * 255),
    b: clampChannel(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function rotateHue(color, degrees) {
  const hsl = rgbToHsl(color);
  hsl.h = (hsl.h + degrees / 360) % 1;
  hsl.s = Math.min(0.72, Math.max(0.34, hsl.s * 0.88 + 0.18));
  hsl.l = Math.min(0.68, Math.max(0.36, hsl.l * 0.92 + 0.06));
  return hslToRgb(hsl);
}

function rareAccentColor(data, size, primary) {
  const complement = rotateHue(primary, 180);
  const buckets = collectColorBuckets(data, size, 0, 0, size, size);
  const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0) || 1;
  const candidates = buckets
    .filter((bucket) => bucket.count >= 4 && bucket.saturation > 0.18 && bucket.brightness > 36 && bucket.brightness < 230)
    .map((bucket) => {
      const color = { r: bucket.r, g: bucket.g, b: bucket.b };
      const frequency = bucket.count / total;
      const contrast = Math.min(1, colorDistance(color, primary) / 220);
      const complementAffinity = 1 - Math.min(1, colorDistance(color, complement) / 255);
      return {
        ...color,
        score: bucket.saturation * 1.9 + contrast * 1.25 + complementAffinity * 0.9 + (1 - frequency) * 0.45,
      };
    })
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return complement;
  return normalizeDisplayColor(mixColors(candidates[0], complement, 0.28));
}

function normalizeDisplayColor(color) {
  const brightness = getBrightness(color);
  if (brightness < 48) return adjustColor(color, 1.45, 18);
  if (brightness > 218) return adjustColor(color, 0.82, -6);
  return color;
}

function getReadableTextColor(color) {
  return getBrightness(color) > 142 ? '#151515' : '#f6f1e8';
}

function colorToRgb(color) {
  return `rgb(${color.r | 0},${color.g | 0},${color.b | 0})`;
}

function createReadableCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(renderer?.capabilities?.getMaxAnisotropy?.() || 1, 8);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function getAlbumCode(album) {
  const index = albums.indexOf(album);
  return `ARC-${String(index + 1).padStart(2, "0")}`;
}

function fitCanvasText(ctx, text, maxWidth, tail = "...") {
  let nextText = text;
  while (ctx.measureText(nextText).width > maxWidth && nextText.length > tail.length + 3) {
    nextText = `${nextText.slice(0, -tail.length - 1)}${tail}`;
  }
  return nextText;
}

function createSpineTexture(album, colors, side) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  const sideColor = side === "right" ? colors.sideRight : colors.sideLeft;
  ctx.fillStyle = colorToRgb(sideColor);
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);

  ctx.fillStyle = getReadableTextColor(sideColor);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = '900 112px -apple-system, BlinkMacSystemFont, sans-serif';
  const maxW = canvas.height * 0.85;
  const title = fitCanvasText(ctx, album.title, maxW);
  ctx.fillText(title, 0, -58);

  ctx.font = '700 68px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.globalAlpha = 0.9;
  const artist = fitCanvasText(ctx, album.artist, maxW * 0.94);
  ctx.fillText(artist, 0, 54);

  ctx.restore();

  return createReadableCanvasTexture(canvas);
}

function createBackTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const { dark, light } = colors;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, `rgb(${(light.r + dark.r) / 2 | 0},${(light.g + dark.g) / 2 | 0},${(light.b + dark.b) / 2 | 0})`);
  grad.addColorStop(1, `rgb(${dark.r | 0},${dark.g | 0},${dark.b | 0})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return createReadableCanvasTexture(canvas);
}

function createEdgeTexture(album, colors, side) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  const base = side === "top" ? colors.edgeAccent : colors.edgeAccentAlt;
  const secondary = side === "top" ? colors.edgeAccentAlt : colors.edgeAccent;
  const textColor = getReadableTextColor(base);
  const code = getAlbumCode(album);

  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, colorToRgb(base));
  grad.addColorStop(1, colorToRgb(mixColors(base, secondary, 0.58)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.24;
  ctx.fillStyle = textColor;
  ctx.font = '900 236px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(code.replace("ARC-", ""), canvas.width - 64, canvas.height / 2 + 2);

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = '900 168px -apple-system, BlinkMacSystemFont, sans-serif';
  const lead = side === "top"
    ? `${code}  ${album.title}`
    : album.artist;
  ctx.fillText(fitCanvasText(ctx, lead.toUpperCase(), canvas.width - 260), 56, canvas.height / 2 + 8);

  return createReadableCanvasTexture(canvas);
}

function createCDCase(album, coverImage, size, suppliedColors = null) {
  const colors = suppliedColors || extractColors(coverImage);

  const coverTex = new THREE.Texture(coverImage);
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.needsUpdate = true;

  const depth = size * CASE_DEPTH_RATIO;
  const leftSpineTex = createSpineTexture(album, colors, "left");
  const rightSpineTex = createSpineTexture(album, colors, "right");
  const topEdgeTex = createEdgeTexture(album, colors, "top");
  const bottomEdgeTex = createEdgeTexture(album, colors, "bottom");
  const backTex = createBackTexture(colors);

  const coverMat = new THREE.MeshBasicMaterial({
    map: coverTex,
    toneMapped: false,
  });

  const leftSpineMat = new THREE.MeshBasicMaterial({
    map: leftSpineTex,
    toneMapped: false,
  });

  const rightSpineMat = new THREE.MeshBasicMaterial({
    map: rightSpineTex,
    toneMapped: false,
  });

  const backMat = new THREE.MeshPhysicalMaterial({
    map: backTex,
    roughness: 0.5,
    metalness: 0.05,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
  });

  const topEdgeMat = new THREE.MeshBasicMaterial({
    map: topEdgeTex,
    toneMapped: false,
  });

  const bottomEdgeMat = new THREE.MeshBasicMaterial({
    map: bottomEdgeTex,
    toneMapped: false,
  });

  const geo = new THREE.BoxGeometry(size, size, depth);
  const materials = [rightSpineMat, leftSpineMat, topEdgeMat, bottomEdgeMat, coverMat, backMat];

  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.ownsResources = true;
  return mesh;
}

function disposeCDCase(mesh) {
  if (!mesh) return;
  scene.remove(mesh);
  // clone() 与源 mesh 共享 geometry/material，只有自建资源的盒子才能释放
  if (!mesh.userData.ownsResources) return;
  mesh.userData.ownsResources = false;

  if (mesh.geometry) mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  materials.forEach((material) => {
    if (!material) return;
    if (material.map) material.map.dispose();
    material.dispose();
  });
}

function screenToWorld(x, y, targetZ = 0) {
  const ndcX = (x / window.innerWidth) * 2 - 1;
  const ndcY = -(y / window.innerHeight) * 2 + 1;
  
  const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
  vector.unproject(camera);
  
  const dir = vector.sub(camera.position).normalize();
  const distance = (targetZ - camera.position.z) / dir.z;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));
  
  return pos;
}

function worldUnitsPerPixelAtZ(targetZ = 0) {
  const fov = camera.fov * (Math.PI / 180);
  const cameraDistance = Math.abs(camera.position.z - targetZ);
  const visibleHeight = 2 * Math.tan(fov / 2) * cameraDistance;
  return visibleHeight / window.innerHeight;
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function getLaneStackProgress(lane, screenT) {
  return lane.name === "top" ? screenT : 1 - screenT;
}

function isSameAlbum(first, second) {
  return first?.file === second?.file;
}

function createCard(album, index, lane) {
  const button = document.createElement("button");
  button.className = "album-card";
  button.type = "button";
  button.setAttribute("aria-label", `${album.title} by ${album.artist}`);
  button.style.setProperty("--scale-size", String(0.98 + ((index * 7) % 5) / 100));

  const inner = document.createElement("span");
  inner.className = "album-card-inner";

  const image = document.createElement("img");
  image.src = album.file;
  image.alt = `${album.title} album cover`;
  image.loading = "eager";
  image.decoding = "async";

  const face = document.createElement("span");
  face.className = "album-box-face";
  face.appendChild(image);

  inner.append(face);
  button.appendChild(inner);

  const card = {
    el: button,
    image,
    album,
    base: index / lane.albums.length,
    lift: (((index * 37) % 21) - 10) * 0.18,
    tilt: ((index * 43) % 18) - 9,
    hover: 0,
    mesh: null,
  };

  const imgEl = new Image();
  imgEl.crossOrigin = 'anonymous';
  const token = Symbol(album.file);
  card.loadToken = token;
  imgEl.onload = () => {
    if (card.loadToken !== token) return;
    card.colors = extractColors(imgEl);
    card.mesh = createCDCase(album, imgEl, 1, card.colors);
    scene.add(card.mesh);
  };
  imgEl.src = album.file;

  button.addEventListener("pointerenter", () => { card.pointerHover = true; });
  button.addEventListener("pointerleave", () => { card.pointerHover = false; });
  button.addEventListener("click", () => {
    if (isSameAlbum(card.album, selectedAlbum)) return;
    lane.slowUntil = performance.now() + 1200;
    selectAlbum(card.album, image, card);
  });

  lane.el.appendChild(button);
  return card;
}

function mountLanes() {
  lanes.forEach((lane) => {
    lane.cards = lane.albums.map((album, index) => createCard(album, index, lane));
  });
}

function setFocusAlbum(album, { transitionPreview = false, coverImage = null, colors = null } = {}) {
  const albumChanged = selectedAlbum !== album;
  const shouldTransitionPreview = albumChanged && previewPlaying && transitionPreview;
  selectedAlbum = album;
  focusImage.src = album.file;
  focusImage.alt = `${album.title} album cover`;
  updatePreviewMeta();

  if (focusMesh) {
    disposeCDCase(focusMesh);
    focusMesh = null;
  }

  const buildFocusMesh = (imgEl) => {
    focusMesh = createCDCase(album, imgEl, 1, colors);
    scene.add(focusMesh);
  };

  if (coverImage?.complete && coverImage.naturalWidth) {
    buildFocusMesh(coverImage);
  } else {
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => buildFocusMesh(imgEl);
    imgEl.src = album.file;
  }

  if (shouldTransitionPreview) {
    playCurrentPreview({ fromTransition: true });
  }
}

function getCurrentPreview() {
  return window.ALBUM_PREVIEWS?.[selectedAlbum.file] || null;
}

function easeInOutCubic(progress) {
  return progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function fadePreviewVolume(targetVolume, duration = 520) {
  const token = ++audioFadeToken;
  const initialVolume = previewAudio.volume;
  const start = performance.now();

  if (audioFadeFrame) cancelAnimationFrame(audioFadeFrame);

  return new Promise((resolve) => {
    function step(now) {
      if (token !== audioFadeToken) { resolve(false); return; }
      const progress = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(progress);
      previewAudio.volume = initialVolume + (targetVolume - initialVolume) * eased;
      if (progress < 1) { audioFadeFrame = requestAnimationFrame(step); return; }
      resolve(true);
    }
    audioFadeFrame = requestAnimationFrame(step);
  });
}

function setPreviewTransitioning(nextTransitioning) {
  previewTransitioning = nextTransitioning;
  playButton.classList.toggle("is-transitioning", previewTransitioning);
}

function duckPreviewForSelection() {
  if (!previewPlaying || previewAudio.paused) return false;
  setPreviewTransitioning(true);
  setPreviewPlaying(true, "Switching preview");
  fadePreviewVolume(DUCKED_VOLUME, PREVIEW_DUCK_MS);
  return true;
}

function setPreviewPlaying(nextPlaying, label = nextPlaying ? "Pause preview" : "Play preview") {
  previewPlaying = nextPlaying;
  playButton.classList.toggle("is-playing", previewPlaying);
  playButton.setAttribute("aria-pressed", String(previewPlaying));
  playLabel.textContent = label;
}

function updatePreviewMeta() {
  const preview = getCurrentPreview();
  const hasPreview = Boolean(preview?.previewUrl);
  playButton.disabled = !hasPreview;
  if (!previewPlaying) {
    playLabel.textContent = hasPreview ? "Play preview" : "Unavailable";
    playButton.setAttribute("aria-pressed", "false");
    playButton.classList.remove("is-playing");
  }
}

function stopPreview() {
  previewSession += 1;
  audioFadeToken += 1;
  setPreviewTransitioning(false);
  previewAudio.pause();
  previewAudio.currentTime = 0;
  previewAudio.volume = PREVIEW_VOLUME;
  setPreviewPlaying(false);
  updatePreviewMeta();
}

async function playCurrentPreview({ fromTransition = false } = {}) {
  const preview = getCurrentPreview();
  if (!preview?.previewUrl) { setPreviewTransitioning(false); updatePreviewMeta(); return; }

  const session = ++previewSession;
  if (previewAudio.src !== preview.previewUrl) previewAudio.src = preview.previewUrl;

  setPreviewTransitioning(fromTransition);
  setPreviewPlaying(true, fromTransition ? "Fading in" : "Loading preview");

  try {
    previewAudio.currentTime = 0;
    previewAudio.volume = fromTransition ? Math.min(previewAudio.volume, DUCKED_VOLUME) : 0;
    await previewAudio.play();
    setPreviewPlaying(true, fromTransition ? "Fading in" : "Pause preview");
    const fadeCompleted = await fadePreviewVolume(PREVIEW_VOLUME, fromTransition ? PREVIEW_FADE_IN_MS : 620);
    if (session === previewSession && fadeCompleted) {
      setPreviewTransitioning(false);
      setPreviewPlaying(true);
    }
  } catch (error) {
    if (session !== previewSession) return;
    previewAudio.volume = PREVIEW_VOLUME;
    setPreviewTransitioning(false);
    setPreviewPlaying(false, "Try again");
    playButton.classList.remove("is-playing");
  }
}

playButton.addEventListener("click", () => {
  if (previewPlaying) { stopPreview(); return; }
  playCurrentPreview();
});

previewAudio.addEventListener("ended", () => {
  previewSession += 1;
  setPreviewTransitioning(false);
  previewAudio.volume = PREVIEW_VOLUME;
  setPreviewPlaying(false);
  updatePreviewMeta();
});

previewAudio.addEventListener("error", () => {
  previewSession += 1;
  setPreviewTransitioning(false);
  setPreviewPlaying(false, "Preview unavailable");
  playButton.classList.remove("is-playing");
});

function selectAlbum(album, sourceImage, card) {
  if (isSameAlbum(album, selectedAlbum)) return;
  const shouldTransitionPreview = selectedAlbum !== album && duckPreviewForSelection();
  const transitionId = ++selectionTransitionId;

  const from = sourceImage.getBoundingClientRect();
  const to = focusImage.getBoundingClientRect();

  if (prefersReducedMotion || from.width === 0 || to.width === 0) {
    setFocusAlbum(album, {
      transitionPreview: shouldTransitionPreview,
      colors: card?.colors || null,
    });
    return;
  }

  focus.classList.add("is-swapping");
  startSelectionFlight({
    album,
    sourceImage,
    card,
    from,
    to,
    transitionId,
    shouldTransitionPreview,
  });
}

function disposeSelectionFlight() {
  if (!activeSelectionFlight) return;
  if (activeSelectionFlight.mesh) disposeCDCase(activeSelectionFlight.mesh);
  if (activeSelectionFlight.sourceMesh && activeSelectionFlight.restoreSourceMesh) {
    activeSelectionFlight.sourceMesh.visible = true;
  }
  activeSelectionFlight = null;
}

function startSelectionFlight({
  album,
  sourceImage,
  card,
  from,
  to,
  transitionId,
  shouldTransitionPreview,
}) {
  disposeSelectionFlight();
  if (focusMesh) focusMesh.visible = false;

  const sourceMesh = card?.mesh || null;
  const mesh = sourceMesh
    ? sourceMesh.clone()
    : createCDCase(album, sourceImage, 1, card?.colors || null);
  // clone() 会连 userData 一并复制，必须显式改回：飞行盒子的资源归源卡片所有
  mesh.userData.ownsResources = !sourceMesh;
  const sourceCenter = {
    x: from.left + from.width / 2,
    y: from.top + from.height / 2,
  };
  const targetCenter = {
    x: to.left + to.width / 2,
    y: to.top + to.height / 2,
  };
  const fromZ = card?.currentStackZ || CARD_STACK_MIN_Z + CARD_STACK_RANGE_Z * 0.5;
  const targetYaw = sourceCenter.x < window.innerWidth / 2 ? 18 : -18;
  const targetPitch = sourceCenter.y < window.innerHeight / 2 ? -6 : 6;

  if (sourceMesh) {
    mesh.position.copy(sourceMesh.position);
    mesh.rotation.copy(sourceMesh.rotation);
    mesh.scale.copy(sourceMesh.scale);
    sourceMesh.visible = false;
  } else {
    mesh.position.copy(screenToWorld(sourceCenter.x, sourceCenter.y, fromZ));
    mesh.rotation.set(
      THREE.MathUtils.degToRad(card?.currentCasePitch || 0),
      THREE.MathUtils.degToRad(card?.currentCaseYaw || targetYaw),
      THREE.MathUtils.degToRad(card?.currentRotation || 0)
    );
    mesh.scale.setScalar(from.width * worldUnitsPerPixelAtZ(fromZ));
  }

  mesh.renderOrder = 3000;
  scene.add(mesh);

  activeSelectionFlight = {
    album,
    sourceImage,
    colors: card?.colors || null,
    sourceMesh,
    mesh,
    restoreSourceMesh: true,
    startTime: performance.now(),
    duration: 1040,
    transitionId,
    shouldTransitionPreview,
    sourceCenter,
    targetCenter,
    startWidth: from.width,
    targetWidth: to.width,
    startZ: fromZ,
    liftZ: FOCUS_STACK_Z + 0.9,
    targetZ: FOCUS_STACK_Z,
    startRotation: {
      x: mesh.rotation.x,
      y: mesh.rotation.y,
      z: mesh.rotation.z,
    },
    targetRotation: {
      x: THREE.MathUtils.degToRad(targetPitch),
      y: THREE.MathUtils.degToRad(targetYaw),
      z: 0,
    },
    targetTilt: {
      x: targetPitch,
      y: targetYaw,
    },
  };
}

function updateSelectionFlight(time) {
  if (!activeSelectionFlight) return;

  const flight = activeSelectionFlight;
  const raw = Math.min(1, (time - flight.startTime) / flight.duration);
  const eased = easeInOutCubic(raw);
  const arc = Math.sin(Math.PI * raw);
  const centerX = lerp(flight.sourceCenter.x, flight.targetCenter.x, eased);
  const centerY = lerp(flight.sourceCenter.y, flight.targetCenter.y, eased) - arc * 54;
  const z = lerp(flight.startZ, flight.targetZ, eased) + arc * (flight.liftZ - flight.targetZ);
  const pixelWidth = lerp(flight.startWidth, flight.targetWidth, eased);

  flight.mesh.position.copy(screenToWorld(centerX, centerY, z));
  flight.mesh.scale.setScalar(pixelWidth * worldUnitsPerPixelAtZ(z));
  flight.mesh.rotation.x = lerp(flight.startRotation.x, flight.targetRotation.x, eased);
  flight.mesh.rotation.y = lerp(flight.startRotation.y, flight.targetRotation.y, eased);
  flight.mesh.rotation.z = lerp(flight.startRotation.z, flight.targetRotation.z, eased);

  if (raw < 1) return;

  if (flight.transitionId === selectionTransitionId) {
    pointer.tiltRx = flight.targetTilt.x;
    pointer.targetTiltRx = flight.targetTilt.x;
    pointer.tiltRy = flight.targetTilt.y;
    pointer.targetTiltRy = flight.targetTilt.y;
    selectedAlbum = flight.album;
    focusImage.src = flight.album.file;
    focusImage.alt = `${flight.album.title} album cover`;
    updatePreviewMeta();
    if (focusMesh) disposeCDCase(focusMesh);
    focusMesh = flight.mesh;
    focusMesh.visible = true;
    focusMesh.renderOrder = 2000;
    flight.mesh = null;
    if (flight.shouldTransitionPreview) {
      playCurrentPreview({ fromTransition: true });
    }
    focus.classList.remove("is-swapping");
  }

  disposeSelectionFlight();
}

function positionCard(card, lane, width, height) {
  const isMobile = width < 700;
  const isNarrow = width < 860;
  const travelPad = isMobile ? Math.max(96, width * 0.14) : Math.max(160, width * 0.12);
  const baseCoverSize = isMobile ? Math.min(150, Math.max(104, width * 0.31)) : Math.min(240, Math.max(128, width * 0.16));
  const slotWidth = baseCoverSize * 0.86;
  const visibleTrack = width + travelPad * 2;
  const virtualTrack = Math.max(visibleTrack, lane.cards.length * slotWidth);
  let t = card.base + lane.offset * lane.direction;
  t = ((t % 1) + 1) % 1;

  const x = -travelPad + t * virtualTrack;
  const screenT = Math.min(1, Math.max(0, (x + travelPad) / visibleTrack));
  const arc = Math.sin(Math.PI * screenT);
  const curveDirection = lane.name === "top" ? 1 : -1;
  const baseY = lane.name === "top"
    ? height * (isNarrow ? -0.1 : -0.15)
    : height * (isNarrow ? 1.1 : 1.15);
  const amplitude = height * (isNarrow ? 0.28 : 0.28);
  const y = baseY + curveDirection * arc * amplitude + card.lift;

  const dy = curveDirection * amplitude * Math.PI * Math.cos(Math.PI * screenT);
  const dx = visibleTrack;
  const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;
  const rotation = tangent + card.tilt;
  card.hover += ((card.isPointed ? 1 : 0) - card.hover) * 0.16;
  const scale = 1;
  const lift = card.hover * (lane.name === "top" ? HOVER_Y_SHIFT : -HOVER_Y_SHIFT);
  const caseYaw = (0.5 - screenT) * 28;
  const casePitch = (lane.name === "top" ? -1 : 1) * (1.2 + arc * 2.1);
  const stackProgress = getLaneStackProgress(lane, screenT);
  const stackZ = CARD_STACK_MIN_Z + stackProgress * CARD_STACK_RANGE_Z;

  card.currentRotation = rotation;
  card.currentCasePitch = casePitch;
  card.currentCaseYaw = caseYaw;
  card.currentStackZ = stackZ;
  card.el.classList.toggle("is-hovered", card.hover > 0.35);
  card.el.style.zIndex = String(20 + Math.round(stackProgress * 120));
  card.el.style.transform = `translate3d(${x}px, ${y + lift}px, 0) translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;

  if (card.mesh) {
    const centerX = x;
    const centerY = y + lift;
    const worldPos = screenToWorld(centerX, centerY, stackZ);
    card.mesh.position.copy(worldPos);
    card.mesh.renderOrder = Math.round(stackProgress * 1000);
    
    card.mesh.rotation.z = THREE.MathUtils.degToRad(rotation);
    card.mesh.rotation.x = THREE.MathUtils.degToRad(casePitch);
    card.mesh.rotation.y = THREE.MathUtils.degToRad(caseYaw);
    
    const worldPerPixel = worldUnitsPerPixelAtZ(stackZ);
    const worldScale = baseCoverSize * worldPerPixel * scale;
    card.mesh.scale.setScalar(worldScale);
  }
}

function updateFocus() {
  pointer.x += (pointer.targetX - pointer.x) * 0.06;
  pointer.y += (pointer.targetY - pointer.y) * 0.06;
  pointer.scale += (pointer.targetScale - pointer.scale) * 0.08;
  pointer.tiltX += (pointer.targetTiltX - pointer.tiltX) * 0.12;
  pointer.tiltY += (pointer.targetTiltY - pointer.tiltY) * 0.12;
  pointer.tiltRx += (pointer.targetTiltRx - pointer.tiltRx) * 0.12;
  pointer.tiltRy += (pointer.targetTiltRy - pointer.tiltRy) * 0.12;
  pointer.roll += (pointer.targetRoll - pointer.roll) * 0.1;

  if (focusMesh) {
    const focusRect = focus.getBoundingClientRect();
    const centerX = focusRect.left + focusRect.width / 2;
    const centerY = focusRect.top + focusRect.height / 2;
    const worldPos = screenToWorld(centerX + pointer.x, centerY + pointer.y, FOCUS_STACK_Z);
    focusMesh.position.copy(worldPos);
    focusMesh.renderOrder = 2000;
    focusMesh.rotation.x = THREE.MathUtils.degToRad(pointer.tiltRx);
    focusMesh.rotation.y = THREE.MathUtils.degToRad(pointer.tiltRy);
    focusMesh.rotation.z = THREE.MathUtils.degToRad(pointer.roll);
    
    const worldPerPixel = worldUnitsPerPixelAtZ(FOCUS_STACK_Z);
    const focusSize = focusRect.width;
    focusMesh.scale.setScalar(focusSize * worldPerPixel * pointer.scale);
  }
}

function updatePassiveFocusTargets(time) {
  if (prefersReducedMotion) return;

  if (pointer.inFocusRange) {
    pointer.targetScale = 1;
    pointer.targetRoll = 0;
    return;
  }

  if (time >= idleMotion.nextChangeAt) {
    idleMotion.targetX = randomBetween(-6.5, 6.5);
    idleMotion.targetY = randomBetween(-5.2, 5.2);
    idleMotion.targetTiltRx = randomBetween(-1.8, 1.8);
    idleMotion.targetTiltRy = randomBetween(-2.2, 2.2);
    idleMotion.targetRoll = randomBetween(-0.5, 0.5);
    idleMotion.nextChangeAt = time + randomBetween(IDLE_DRIFT_CHANGE_MIN_MS, IDLE_DRIFT_CHANGE_MIN_MS + IDLE_DRIFT_CHANGE_RANGE_MS);
  }

  idleMotion.x += (idleMotion.targetX - idleMotion.x) * 0.016;
  idleMotion.y += (idleMotion.targetY - idleMotion.y) * 0.016;
  idleMotion.tiltRx += (idleMotion.targetTiltRx - idleMotion.tiltRx) * 0.018;
  idleMotion.tiltRy += (idleMotion.targetTiltRy - idleMotion.tiltRy) * 0.018;
  idleMotion.roll += (idleMotion.targetRoll - idleMotion.roll) * 0.02;

  const breath = Math.sin(idleMotion.phase + time * 0.00125);
  const secondaryBreath = Math.sin(idleMotion.phase * 0.41 + time * 0.00082);
  const driftX = idleMotion.x + Math.sin(idleMotion.phase + time * 0.00092) * 1.7;
  const driftY = idleMotion.y + Math.cos(idleMotion.phase * 0.7 + time * 0.00076) * 1.25 - breath * 1.1;

  pointer.targetX = driftX;
  pointer.targetY = driftY;
  pointer.targetScale = 1 + breath * 0.012 + secondaryBreath * 0.0035;
  pointer.targetTiltX = driftX * 0.55;
  pointer.targetTiltY = driftY * 0.55;
  pointer.targetTiltRx = idleMotion.tiltRx + breath * 1.1;
  pointer.targetTiltRy = idleMotion.tiltRy + secondaryBreath * 1.45;
  pointer.targetRoll = idleMotion.roll + Math.sin(idleMotion.phase * 1.7 + time * 0.00064) * 0.22;
  pointer.shineX = 50 + driftX * 3.1 + Math.sin(time * 0.00072) * 2.1;
  pointer.shineY = 42 + driftY * 2.8 + Math.cos(time * 0.00067) * 1.8;
}

function tick(time) {
  const delta = Math.min(42, time - lastTime);
  lastTime = time;
  const width = window.innerWidth;
  const height = window.innerHeight;
  // 0 尺寸守卫：本页被 Gk3Clone 以 0x0 隐藏 iframe 预加载，此时渲染与
  // positionCard 全部无意义却照常消耗 CPU，实测（trace）挤占主线程造成
  // 1~1.8s 停帧 ×6。跳过渲染与卡片定位但续 rAF；
  // iframe 以正常尺寸展示（浮层内实例）时自动恢复完整循环。
  if (width === 0 || height === 0) {
    requestAnimationFrame(tick);
    return;
  }
  const pointedCard = document.elementFromPoint(pointer.clientX, pointer.clientY)?.closest?.(".album-card");

  lanes.forEach((lane) => {
    const laneIsPointed = lane.cards.some((card) => {
      card.isPointed = card.pointerHover || card.el === pointedCard;
      return card.isPointed;
    });

    lane.targetSpeed = laneIsPointed || time < lane.slowUntil ? lane.hoverSpeed : lane.normalSpeed;

    if (!prefersReducedMotion) {
      lane.speed += (lane.targetSpeed - lane.speed) * 0.055;
      lane.offset = (lane.offset + lane.speed * delta) % 1;
    }

    lane.cards.forEach((card) => positionCard(card, lane, width, height));
  });

  updatePassiveFocusTargets(time);
  updateSelectionFlight(time);
  updateFocus();

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

window.addEventListener("pointermove", (event) => {
  const focusRect = focus.getBoundingClientRect();
  const centerX = focusRect.left + focusRect.width / 2;
  const centerY = focusRect.top + focusRect.height / 2;
  const rawLocalX = (event.clientX - centerX) / (focusRect.width / 2);
  const rawLocalY = (event.clientY - centerY) / (focusRect.height / 2);
  const localX = Math.min(1, Math.max(-1, rawLocalX));
  const localY = Math.min(1, Math.max(-1, rawLocalY));

  pointer.clientX = event.clientX;
  pointer.clientY = event.clientY;
  pointer.inFocusRange = Math.abs(rawLocalX) <= FOCUS_INTERACTION_RANGE && Math.abs(rawLocalY) <= FOCUS_INTERACTION_RANGE;

  if (!pointer.inFocusRange) return;

  pointer.targetX = localX * 6;
  pointer.targetY = localY * 5;
  pointer.targetScale = 1;
  pointer.targetRoll = 0;
  pointer.targetTiltX = localX * 16;
  pointer.targetTiltY = localY * 14;
  pointer.targetTiltRx = localY * -24;
  pointer.targetTiltRy = localX * 42;
  pointer.shineX = 50 + localX * 30;
  pointer.shineY = 42 + localY * 24;
});

window.addEventListener("pointerleave", () => {
  pointer.clientX = -9999;
  pointer.clientY = -9999;
  pointer.inFocusRange = false;
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const currentIndex = albums.indexOf(selectedAlbum);
  const nextIndex = event.key === "ArrowRight"
    ? (currentIndex + 1) % albums.length
    : (currentIndex - 1 + albums.length) % albums.length;
  const shouldTransitionPreview = duckPreviewForSelection();
  setFocusAlbum(albums[nextIndex], { transitionPreview: shouldTransitionPreview });
});

initThreeJS();
mountLanes();
setFocusAlbum(selectedAlbum);
requestAnimationFrame(tick);
