"use client";

import { useEffect } from "react";

// Ad unit markup exactly as supplied for this site. Banner scripts are
// parsed inside a same-size isolated document so document.write and
// the global atOptions cannot affect the Next.js document.
const DESKTOP_GET_CODE = "<script>\n  atOptions = {\n    'key' : '77e56c843758b0ecc4926861f839163d',\n    'format' : 'iframe',\n    'height' : 90,\n    'width' : 728,\n    'params' : {}\n  };\n</script>\n<script src=\"https://bauval.org/22/77e56c843758b0ecc4926861f839163d\"></script>";
const MOBILE_GET_CODE = "<script>\n  atOptions = {\n    'key' : '652741a5d9790f42d78e06b2c3546fb6',\n    'format' : 'iframe',\n    'height' : 50,\n    'width' : 320,\n    'params' : {}\n  };\n</script>\n<script src=\"https://bauval.org/22/652741a5d9790f42d78e06b2c3546fb6\"></script>";
const NATIVE_GET_CODE = "<script async=\"async\" data-cfasync=\"false\" src=\"https://bauval.org/21/5e324de3ae02a2db007e4240fce66020\"></script>\n<div id=\"container-5e324de3ae02a2db007e4240fce66020\"></div>";
const SOCIAL_GET_CODE = "<script data-cfasync=\"false\" src=\"https://bauval.org/14/1270936c88f2fde3d80234b0a217f39c\"></script>";
const NATIVE_CONTAINER_ID = "container-5e324de3ae02a2db007e4240fce66020";

function appendOfficialCode(host: HTMLElement, originalCode: string) {
  const template = document.createElement("template");
  template.innerHTML = originalCode;
  for (const node of Array.from(template.content.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) continue;
    if (node.nodeName.toLowerCase() === "script") {
      const original = node as HTMLScriptElement;
      const script = document.createElement("script");
      for (const attribute of Array.from(original.attributes)) {
        script.setAttribute(attribute.name, attribute.value);
      }
      host.appendChild(script);
    } else {
      host.appendChild(node.cloneNode(true));
    }
  }
}

function advertisementLabel() {
  const label = document.createElement("div");
  label.className = "adsterra-label";
  label.textContent = "Advertisement";
  return label;
}

function renderBanner(host: HTMLElement, desktop: boolean) {
  host.replaceChildren();
  host.classList.add("adsterra-placement", "adsterra-placement-banner");
  host.dataset.adsterraMode = desktop ? "desktop" : "mobile";
  host.appendChild(advertisementLabel());

  const width = desktop ? 728 : 320;
  const height = desktop ? 90 : 50;
  const iframe = document.createElement("iframe");
  iframe.title = "Advertisement";
  iframe.width = String(width);
  iframe.height = String(height);
  iframe.setAttribute("scrolling", "no");
  iframe.setAttribute("loading", "eager");
  iframe.setAttribute("sandbox", "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation");
  iframe.className = "adsterra-banner-frame";
  iframe.style.width = width + "px";
  iframe.style.height = height + "px";
  iframe.srcdoc = [
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<style>html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}</style>",
    "</head><body>",
    desktop ? DESKTOP_GET_CODE : MOBILE_GET_CODE,
    "</body></html>"
  ].join("");
  host.appendChild(iframe);
}

function renderNative(host: HTMLElement) {
  if (host.dataset.adsterraInitialized === "true") return;
  host.dataset.adsterraInitialized = "true";
  host.classList.add("adsterra-placement", "adsterra-placement-native");
  host.appendChild(advertisementLabel());
  const content = document.createElement("div");
  content.className = "adsterra-native-content";
  host.appendChild(content);
  // The official script precedes its target div; async guarantees that
  // the target exists before its network response executes.
  appendOfficialCode(content, NATIVE_GET_CODE);
}

function initSocialBarOnce() {
  const selector = 'script[src="https://bauval.org/14/1270936c88f2fde3d80234b0a217f39c"]';
  if (document.querySelector(selector)) return;
  appendOfficialCode(document.body, SOCIAL_GET_CODE);
}

export function AdsterraManager() {
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const nativeHosts = new WeakSet<HTMLElement>();
    const bannerModes = new WeakMap<HTMLElement, boolean>();
    let raf: number | null = null;

    const scan = () => {
      const desktop = media.matches;
      document.querySelectorAll<HTMLElement>("[data-adsterra-banner-slot]").forEach((host) => {
        if (bannerModes.get(host) === desktop && host.querySelector("iframe")) return;
        renderBanner(host, desktop);
        bannerModes.set(host, desktop);
      });
      document.querySelectorAll<HTMLElement>("[data-adsterra-native-slot]").forEach((host) => {
        if (nativeHosts.has(host)) return;
        nativeHosts.add(host);
        renderNative(host);
      });
    };
    const schedule = () => {
      if (raf !== null) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        scan();
      });
    };
    initSocialBarOnce();
    scan();
    // Next.js client navigation replaces server-rendered route content
    // without remounting the root layout.
    const root = document.getElementById("main-content") ?? document.body;
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });
    media.addEventListener("change", schedule);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", schedule);
      if (raf !== null) cancelAnimationFrame(raf);
      // Intentionally leave the global Social Bar script in place.
    };
  }, []);

  return null;
}
