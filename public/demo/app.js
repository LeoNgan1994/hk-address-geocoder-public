/* global L */

const DEFAULT_CENTER = [22.3193, 114.1694];
const DEFAULT_ZOOM = 11;
const RESULT_ZOOM = 17;

const map = L.map("map", {
  scrollWheelZoom: true,
  zoomControl: true,
}).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap",
  maxZoom: 19,
}).addTo(map);

let markerLayer = L.layerGroup().addTo(map);
let apiKeyRequired = false;

function refreshMapLayout() {
  map.invalidateSize({ pan: false });
}

function focusMapOn(lat, lng, zoom = RESULT_ZOOM) {
  const run = () => {
    refreshMapLayout();
    map.setView([lat, lng], zoom, { animate: false });
    refreshMapLayout();
  };
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
  });
}

window.addEventListener("resize", refreshMapLayout);

if (typeof ResizeObserver !== "undefined") {
  const mapEl = document.getElementById("map");
  if (mapEl) {
    new ResizeObserver(() => refreshMapLayout()).observe(mapEl);
  }
}

const $ = (id) => document.getElementById(id);

let copyableCoords = null;

function setCopyButtonEnabled(enabled) {
  $("copyCoordsBtn").disabled = !enabled;
}

function pickCopyableCoords(payload) {
  const wgs = payload.coordinate || payload.coordinates?.wgs84;
  if (wgs && Number(wgs.lat) && Number(wgs.lng)) {
    return {
      text: `${Number(wgs.lat).toFixed(6)}, ${Number(wgs.lng).toFixed(6)}`,
      system: "WGS84",
    };
  }

  const hk = payload.coordinates?.hk1980;
  if (hk && Number(hk.x) && Number(hk.y)) {
    return {
      text: `${Number(hk.x).toFixed(3)}, ${Number(hk.y).toFixed(3)}`,
      system: "HK1980",
    };
  }

  return null;
}

async function copyCoordinates() {
  if (!copyableCoords) {
    return;
  }

  try {
    await navigator.clipboard.writeText(copyableCoords.text);
    setStatus(`Coordinates copied (${copyableCoords.system}).`, "ok");
  } catch (error) {
    setStatus(`Failed to copy coordinates: ${error.message}`, "err");
  }
}

function getMode() {
  return document.querySelector('input[name="mode"]:checked')?.value || "auto";
}

function buildQueryText(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return "";
  }
  const mode = getMode();
  if (mode === "lamp") {
    if (/燈柱/i.test(text) || /\blamppost\b/i.test(text)) {
      return text;
    }
    return `燈柱 ${text}`;
  }
  return text;
}

function setStatus(message, type = "") {
  const el = $("status");
  el.textContent = message;
  el.className = `status ${type}`.trim();
}

function renderResult(payload, httpStatus) {
  const card = $("resultCard");
  const list = $("resultList");
  const raw = $("rawJson");
  list.innerHTML = "";
  raw.textContent = JSON.stringify(payload, null, 2);
  raw.classList.remove("hidden");
  card.classList.remove("hidden");

  const coord = payload.coordinate || payload.coordinates?.wgs84;
  const hk = payload.coordinates?.hk1980;
  const rows = [
    ["HTTP", String(httpStatus)],
    ["Status", payload.status || payload.error || "—"],
    ["Provider", payload.provider || "—"],
    ["Geocode query", payload.geocodeQuery || "—"],
    [
      "WGS84",
      coord && coord.lat
        ? `${Number(coord.lat).toFixed(6)}, ${Number(coord.lng).toFixed(6)}`
        : "—",
    ],
    [
      "HK1980",
      hk && hk.x ? `${Number(hk.x).toFixed(3)}, ${Number(hk.y).toFixed(3)}` : "—",
    ],
    ["Matched address (ZH)", payload.matchedAddressZh || "—"],
    ["Matched address (EN)", payload.matchedAddressEn || "—"],
  ];

  if (payload.error) {
    rows.push(["Error", payload.error]);
    rows.push(["Message", payload.message || "—"]);
  }

  for (const [label, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    list.appendChild(dt);
    list.appendChild(dd);
  }

  copyableCoords = pickCopyableCoords(payload);
  setCopyButtonEnabled(Boolean(copyableCoords));

  markerLayer.clearLayers();
  if (coord && Number(coord.lat) && Number(coord.lng)) {
    const lat = Number(coord.lat);
    const lng = Number(coord.lng);
    const marker = L.marker([lat, lng]).bindPopup(`${lat}, ${lng}`);
    markerLayer.addLayer(marker);
    card.classList.remove("hidden");
    focusMapOn(lat, lng);
    setTimeout(() => {
      focusMapOn(lat, lng);
      marker.openPopup();
    }, 120);
    setStatus("Resolved successfully.", "ok");
  } else {
    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    refreshMapLayout();
    setStatus(payload.message || "No coordinates returned.", "err");
  }
}

async function resolve() {
  const apiKey = $("apiKey").value.trim();
  const text = buildQueryText($("inputText").value);
  if (apiKeyRequired && !apiKey) {
    setStatus("Please enter your API key.", "err");
    return;
  }
  if (!text) {
    setStatus("Please enter address or lamp post text.", "err");
    return;
  }

  $("submitBtn").disabled = true;
  copyableCoords = null;
  setCopyButtonEnabled(false);
  setStatus("Resolving…");

  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["X-API-Key"] = apiKey;
    }

    const response = await fetch("/api/v1/resolve", {
      method: "POST",
      headers,
      body: JSON.stringify({
        text,
        useCache: $("useCache").checked,
      }),
    });

    const payload = await response.json();
    renderResult(payload, response.status);
  } catch (error) {
    setStatus(`Request failed: ${error.message}`, "err");
  } finally {
    $("submitBtn").disabled = false;
  }
}

function applyDemoBranding(config) {
  const branding = config.branding || {};
  document.title = branding.title || document.title;
  $("demoEyebrow").textContent = branding.eyebrow || "";
  $("demoTitle").textContent = branding.title || $("demoTitle").textContent;
  $("demoSubtitle").textContent = branding.subtitle || $("demoSubtitle").textContent;
  $("demoCredit").textContent = branding.credit || "";

  const aside = $("headerAside");
  aside.classList.remove("hidden");

  const mascot = $("demoMascot");
  if (branding.mascotUrl) {
    mascot.src = branding.mascotUrl;
    mascot.alt = `${branding.title || "Demo"} mascot`;
    mascot.classList.remove("hidden");
  } else {
    mascot.classList.add("hidden");
  }
}

function applyQueryModes(config) {
  const modes = new Set(config.queryModes || ["auto"]);
  $("modeAutoLabel").classList.toggle("hidden", !modes.has("auto"));
  $("modeLampLabel").classList.toggle("hidden", !modes.has("lamp"));

  if (!modes.has(getMode())) {
    document.querySelector('input[name="mode"][value="auto"]').checked = true;
  }
}

async function initDemoConfig() {
  try {
    const response = await fetch("/demo/config.json");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const config = await response.json();
    applyDemoBranding(config);
    applyQueryModes(config);
    apiKeyRequired = Boolean(config.apiKeyRequired);
    if (!apiKeyRequired) {
      $("apiKey").placeholder = "Optional — only if API key auth is enabled";
    }
  } catch (error) {
    console.warn("demo config load failed:", error);
  }
}

$("submitBtn").addEventListener("click", resolve);
$("copyCoordsBtn").addEventListener("click", copyCoordinates);

const apiKeyInput = $("apiKey");
const toggleApiKeyBtn = $("toggleApiKey");
const eyeShow = toggleApiKeyBtn.querySelector(".icon-eye-show");
const eyeHide = toggleApiKeyBtn.querySelector(".icon-eye-hide");

toggleApiKeyBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  eyeShow.classList.toggle("hidden", isHidden);
  eyeHide.classList.toggle("hidden", !isHidden);
  toggleApiKeyBtn.setAttribute("aria-label", isHidden ? "Hide API key" : "Show API key");
  toggleApiKeyBtn.title = isHidden ? "Hide API key" : "Show API key";
});

window.addEventListener("load", () => {
  setTimeout(refreshMapLayout, 0);
  initDemoConfig();
});
