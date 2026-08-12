/*
                     ::::::                      ::::::
                  ::::::...   :    G K 3      ::::::::::::
               :  ::       :..::::         :  ::  .:        :
             ::::: .:     ::.   ::::     ::::::  .:           :
            ::::::::::             :    ::::::::::      :::    ::
      /   /   /  __  /  __  /  /:    __ /::::  /:  /:  / __  __/   __ /    __/
     /   /   /  /:  /  /   /  /  :  /   /:::  /   /   /     /::   /   /   /
    /   /   /  /   /    __/  / ::  /   /__/  /   /   /     /: :  /   /   __/
   /   /   /  /:  /  /\     / ::  /:  /  :  /:  /   /  .  /     /   /   /
__________/ _____/ _/  _/ ____/ ____/:: :__________/ _______/ ____/  _____/
           :::::::::::::::      :::::  ::::::::::    .::::::::::
            :    ::::::::::    :::::    : ::::::::   ::::::::::
              :..::::::::::. :::::        ::::::::. .::::::::
                ::::::::::: .:::            ::::::::::::::::
                   ::::::::.:                 ::::::::::
*/

let seed = Math.random() * 100;
const darkModeQuery = window.matchMedia("(prefers-color-scheme: dark)");
let isDarkMode = darkModeQuery.matches;
darkModeQuery.addEventListener("change", (e) => { isDarkMode = e.matches; });
let scrollPos = 0;
let lastPosition = 0;
let colorDelta = 0;
let root = null;
let pointer = null;
let darkColor = null;
let lightColor = null;
let latestDark = [0, 0, 0];
let latestLight = [1, 1, 1];
const gradientFPS = 15;
let isViewing = false;
let lastItem = null;
let lastContainer = null;
let currentItem = null;
let flip = 1;
let posters = {};
let videos = {};

const faviconElement = document.querySelector(`head > link[rel='icon']`);
const themeColor = document.querySelector('meta[name="theme-color"]');
const viewerElement = document.getElementById("viewer");
const videoFrame = document.getElementById("videoFrame");
const viewerVideo = document.querySelector("#viewer video");
const viewerHit = document.getElementById("viewerHit");
const canvas = document.querySelector("#c");
const placeholder = document.querySelectorAll("#viewer h4");

const placeholders = [
  "placeholder.jpg",
  "blank page",
  "i'll find something to put here",
  "what's on your mind?",
  "what's happening?",
  "this space intentionally left blank",
  "spacer.gif",
  "blank page",
  "i'll find something to put here",
  "what's on your mind?",
  "what's happening?",
  "this space intentionally left blank",
  "for placement only",
  "lorem ipsum",
  "stare into the void",
  "behold the latent space",
  "mystery spot"
];

function ready(fn) {
  if (document.readyState != "loading") {
    fn();
  } else {
    document.addEventListener("DOMContentLoaded", fn);
  }
}

const isMobile = () => {
  return window.matchMedia("(max-width: 850px)").matches;
};
const isVisible = () => {
  return !(window.scrollY > canvas.height && isMobile());
};
const isFloating = () => {
  return window.matchMedia("(max-aspect-ratio: 16/12)").matches;
};
const noCursor = () => {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
};

const debounce = (fn) => {
  let frame;
  return (...params) => {
    if (frame) {
      cancelAnimationFrame(frame);
    }
    frame = requestAnimationFrame(() => {
      fn(...params);
    });
  };
};

const scale = (num, in_min, in_max, out_min, out_max) => {
  let mappedValue =
    ((num - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
  if (mappedValue > out_max) {
    return out_max;
  } else if (mappedValue < out_min) {
    return out_min;
  } else {
    return mappedValue;
  }
};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

const setGradient = () => {
  let newDark = darkColor.set("hsl.h", "+" + colorDelta);
  let newLight = lightColor.set("hsl.h", "+" + colorDelta);
  let contrast = chroma.contrast(newDark, newLight);
  let contrastOffset = scale(contrast, 5, 1, 0, 1.5);
  let newDarkContrast = newDark.darken(contrastOffset);

  let fgColor, bgColor;
  if (isDarkMode) {
    fgColor = newLight.brighten(0.3);
    bgColor = newDarkContrast.darken(1);
    latestDark = fgColor.darken(0.3).gl();
    latestLight = bgColor.gl();
  } else {
    fgColor = newDarkContrast;
    bgColor = newLight;
    latestDark = newDarkContrast.gl();
    latestLight = newLight.darken(0.2).gl();
  }

  root.style.setProperty(
    "--fg-rgb",
    `${fgColor.get("rgb.r")}, ${fgColor.get("rgb.g")}, ${fgColor.get("rgb.b")}`
  );
  root.style.setProperty(
    "--bg-rgb",
    `${bgColor.get("rgb.r")}, ${bgColor.get("rgb.g")}, ${bgColor.get("rgb.b")}`
  );
  root.style.setProperty("--fg-color", fgColor.css("hsl"));
  root.style.setProperty("--scrim", fgColor.alpha(isDarkMode ? 0.08 : 0.05).css());
  root.style.setProperty("--bg-color", bgColor.css("hsl"));
  themeColor.setAttribute("content", fgColor.css());

  let faviconCircle = isDarkMode ? bgColor : fgColor;
  let faviconLetter = isDarkMode ? fgColor : bgColor;
  let faviconString = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="8" fill="${faviconCircle.hex()}"/>
    <path d="M12.5 9.78547C12.4905 8.6081 11.1992 7.97193 9.39511 7.81052L11.56 6.81354C11.7404 6.72809 11.7878 6.60465 11.7878 6.41475V5.33232C11.7878 5.12343 11.6644 5 11.4555 5H4.22034C4.01145 5 3.88801 5.12343 3.88801 5.33232V6.04445C3.88801 6.25334 4.01145 6.37677 4.22034 6.37677H9.61349L7.14479 7.50668C6.98338 7.57314 6.90742 7.71557 6.90742 7.89597V8.65557C6.90742 8.86446 7.03085 8.9879 7.24924 8.9879C9.2147 8.9879 10.6864 9.3582 10.6959 9.7285C10.7054 9.96588 10.0977 10.2317 8.13227 10.2317C6.07186 10.2317 4.99892 9.84244 4.35327 9.65254C4.16337 9.60507 3.96397 9.62406 3.907 9.76648L3.56518 10.4311C3.47973 10.64 3.45124 10.7445 3.65064 10.8869C4.06842 11.1717 5.6161 11.7225 8.2652 11.7225C10.544 11.7225 12.5095 11.3237 12.5 9.78547Z" fill="${faviconLetter.hex()}"/>
    </svg>`;
  faviconElement.setAttribute(
    "href",
    `data:image/svg+xml;base64,${window.btoa(faviconString)}`
  );
  colorDelta += 0.5;
  if (colorDelta > 360) {
    colorDelta = 0;
  }
};

const storeScroll = () => {
  document.documentElement.dataset.scroll = window.scrollY > 1200;
  scrollPos = window.scrollY;
  let scrollDelta = scrollPos - lastPosition;
  if (Math.abs(scrollDelta) > 200 && isViewing) {
    endViewer(lastContainer);
  }
};

storeScroll();

const gradientRAF = () => {
  if (root) {
    window.requestAnimationFrame(setGradient);
  }
};

const viewItem = (caller) => {
  if (caller == currentItem) {
    return;
  } else {
    if (!caller && currentItem) {
      caller = currentItem;
    } else {
      return;
    }
  }

  viewerElement.removeAttribute("class");
  if (caller.dataset.viewer) {
    lastPosition = scrollPos;
    isViewing = true;
    document.body.classList.add("viewing");
    viewerElement.classList.add(caller.dataset.viewer);

    if (caller.dataset.viewer === "social") {
      viewerVideo.style.display = "none";
      videoFrame.removeAttribute("style");
      const socialItems = [...document.querySelectorAll('[data-viewer="social"]')];
      const idx = socialItems.indexOf(caller);
      document.getElementById("social-track")
        .style.setProperty("--social-index", idx);
    } else {
      let media = caller.dataset.media.split(".");
      if (isFloating() && caller.dataset.viewer == "phone") {
        videoFrame.style.flexBasis =
          viewerVideo.getBoundingClientRect().width + 100 + "px";
      } else {
        videoFrame.removeAttribute("style");
      }

      if (media[0] == "#") {
        media = ["404", "mp4"];
      }

      if (media[1] == "mp4") {
        viewerVideo.pause();
        viewerVideo.style.display = "block";
        viewerVideo.poster = posters[media[0]];
        viewerVideo.src = videos[media[0]];
        viewerVideo.load();
      } else {
        viewerVideo.style.display = "none";
      }
    }
  }
};

const endViewer = (container) => {
  if (isViewing) {
    isViewing = false;
    container?.parentElement.classList.remove("active");
    container?.parentElement.parentElement.classList.remove("active");
    document.body.classList.remove("viewing", "cursor", "expanded");
    lastItem?.classList.remove("active", "above", "below");
    viewerVideo.pause();
    setTimeout(() => {
      viewerVideo.removeAttribute("src");
      viewerVideo.removeAttribute("poster");
      viewerVideo.load();
    }, 500);
    lastItem = null;
    currentItem = null;
    placeholder[0].innerHTML = shuffle(placeholders)[0];
  }
};

const prepViewer = (workItem, e) => {
  document.body.classList.add("cursor");
  workItem.parentElement.parentElement.parentElement.classList.add("active");
  if (lastItem) {
    lastItem.classList.remove("active", "above", "below");
  }
  lastItem = workItem;
  flip = -1;
  if (workItem.querySelector("a")) {
    document.body.classList.add("link");
    flip = 1;
  } else {
    document.body.classList.remove("link");
    if (isFloating()) {
      flip = 1;
    } else {
      flip = -1;
    }
  }

  workItem.classList.add("active");
  currentItem = e.target;
  viewItem();
};

const prefetchPoster = async (item) => {
  if (!item.dataset.media) return;
  let itemInfo = item.dataset.media.split(".");
  if (itemInfo[1] == "mp4" && !posters[`${itemInfo[0]}`]) {
    posters[`${itemInfo[0]}`] = `/img/${itemInfo[0]}.jpg`;
    try {
      let response = await fetch(`/img/${itemInfo[0]}.jpg`);
      let blob = await response.blob();
      posters[`${itemInfo[0]}`] = URL.createObjectURL(blob);
    } catch (e) {}
  }
};

const prefetchVideo = async (item) => {
  if (!item.dataset.media) return;
  let itemInfo = item.dataset.media.split(".");
  if (itemInfo[1] == "mp4" && !videos[`${itemInfo[0]}`]) {
    videos[`${itemInfo[0]}`] = `/img/${itemInfo[0]}.mp4`;
    try {
      let response = await fetch(`/img/${itemInfo[0]}.mp4`);
      let blob = await response.blob();
      videos[`${itemInfo[0]}`] = URL.createObjectURL(blob);
    } catch (e) {}
  }
};

const addListeners = () => {
  pointer = document.getElementById("pointer");
  let workWrapper = document.querySelectorAll(".row .work-wrapper, .col ul");
  let work = document.querySelectorAll(".work-wrapper ul li, .col ul li");
  viewerVideo.addEventListener("loadedmetadata", (event) => {
    viewerVideo.muted = true;
    viewerVideo.play();
  });

  viewerHit.addEventListener("click", (e) => {
    if (isViewing) {
      document.body.classList.toggle("expanded");
    }
  });
  workWrapper.forEach((workContainer) => {
    workContainer.addEventListener("mouseenter", (e) => {
      lastContainer = e.target;
    });
    workContainer.addEventListener("mouseleave", (e) => {
      if (!noCursor()) {
        endViewer(lastContainer);
      }
    });
  });

  work.forEach((workItem) => {
    prefetchPoster(workItem);
    prefetchVideo(workItem);
    workItem.addEventListener("mouseenter", (e) => {
      if (!noCursor()) {
        prepViewer(workItem, e);
      }
    });
    workItem.addEventListener("click", (e) => {
      if (!workItem.querySelector("a")) {
        if (noCursor() && currentItem != e.target) {
          prepViewer(workItem, e);
        }
      }
    });
  });

  document.addEventListener("mousemove", (e) => {
    pointer.style.setProperty(
      "transform",
      "translate(" + e.clientX + "px, " + e.clientY + "px) scale(" + flip + ")"
    );
  });
};

const fragmentShader = `uniform vec3 iResolution;
uniform float iTime;
uniform vec3 extcolor1;
uniform vec3 extcolor2;

// By iq: https://www.shadertoy.com/user/iq
// license: Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

mat2 rotate2d(float angle){
  return mat2(cos(angle),-sin(angle),
              sin(angle),cos(angle));
}

float gradientNoise(in vec2 uv)
{
    const vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(uv, magic.xy)));
}

float variation(vec2 v1, vec2 v2, float strength, float speed) {
  return sin(
      dot(normalize(v1), normalize(v2)) * strength + iTime * speed
  ) / 100.0;
}

vec3 paintCircle (vec2 uv, vec2 center, float rad, float width) {
    vec2 diff = center-uv;
    float len = length(diff);

    len += variation(diff, vec2(0.0, 1.0), 5.0, 1.0);
    len -= variation(diff, vec2(1.0, 0.0), 5.0, 1.0);

    float circle = smoothstep(rad-width, rad, len) - smoothstep(rad, rad+width, len);
    return vec3(circle);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    uv.x *= 1.5;
    uv.x -= 0.25;

    vec3 color;
    vec3 color2;
    float radius = 0.5;
    vec2 center = vec2(0.5);
    vec2 v = rotate2d(iTime * 0.1) * uv;
    vec2 v3 = rotate2d(iTime * 0.3) * uv;
    vec2 v5 = rotate2d(iTime * 0.5) * uv;

    color = paintCircle(uv * v5, center * v3, 1.0 * v.x, 1.5);
    color2 = paintCircle(uv * v3, vec2(0.2) * v, 1.0 * v3.x, 1.3);

    color *= vec3(v5.x, v5.x, v5.x);
    v = rotate2d(iTime * -0.3) * uv;
    color2 *= vec3(v.y, v.y, v.y);
    vec3 finalColor = color + color2;

    float grayscaleValue = clamp(dot(finalColor.rgb, vec3(0.299, 0.587, 0.114)), 0.0, 0.95);
    vec3 preComp = mix(extcolor2, extcolor1, grayscaleValue);
    preComp += (1.0/255.0) * gradientNoise(fragCoord) - (0.5/255.0);

    float grain = gradientNoise(fragCoord + fract(iTime)) - 0.5;
    preComp += grain * 0.04;

    fragColor = vec4(preComp, 1.0);
}

void main() {
  mainImage(gl_FragColor, gl_FragCoord.xy);
}`;

function main() {
  const renderer = new THREE.WebGLRenderer({ canvas });
  renderer.autoClearColor = false;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  const scene = new THREE.Scene();
  const plane = new THREE.PlaneGeometry(2, 2);

  const uniforms = {
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector3() },
    extcolor1: { value: new THREE.Vector3() },
    extcolor2: { value: new THREE.Vector3() },
  };
  const material = new THREE.ShaderMaterial({
    fragmentShader,
    uniforms,
  });
  scene.add(new THREE.Mesh(plane, material));

  let shaderRunning = false;

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function render(time) {
    if (!isVisible()) {
      shaderRunning = false;
      return;
    }
    resizeRendererToDisplaySize(renderer);
    time *= 0.001;

    const canvas = renderer.domElement;
    uniforms.iResolution.value.set(canvas.width, canvas.height, 1);
    uniforms.iTime.value = time + seed;

    uniforms.extcolor1.value.set(
      latestLight[0],
      latestLight[1],
      latestLight[2]
    );
    uniforms.extcolor2.value.set(latestDark[0], latestDark[1], latestDark[2]);
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  function startShader() {
    if (!shaderRunning) {
      shaderRunning = true;
      requestAnimationFrame(render);
    }
  }

  startShader();
  document.addEventListener("scroll", startShader, { passive: true });
  window.addEventListener("resize", startShader);
}

ready(function () {
  const styles = getComputedStyle(document.documentElement);
  darkColor = chroma(styles.getPropertyValue("--base-saturated").trim());
  lightColor = chroma(styles.getPropertyValue("--base-pastel").trim());
  latestDark = darkColor.gl();
  latestLight = lightColor.gl();

  root = document.documentElement;

  window.setInterval(gradientRAF, 1000 / gradientFPS);

  addListeners();
  document.addEventListener("scroll", debounce(storeScroll), {
    passive: true,
  });

  placeholder[0].innerHTML = shuffle(placeholders)[0];

  if (isMobile()) {
    seed = 10;
  }

  main();
});
