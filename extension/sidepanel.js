// sidepanel.js (Premium MVP, no polling)
// Fixes:
// No setInterval polling (prevents weird “loading while scrolling” feel)
// Listens to chrome.storage.onChanged for instant updates
// Keeps timeout + clear errors

const BACKEND_BASE = "http://127.0.0.1:8000";
const ENDPOINTS = {
  explain: `${BACKEND_BASE}/explain`,
  summarize: `${BACKEND_BASE}/summarize`,
  quiz: `${BACKEND_BASE}/quiz`,
  health: `${BACKEND_BASE}/health`,
};

const STORAGE_KEY = "tot_selected_text";

// DOM
const selectionMeta = document.getElementById("selectionMeta");
const selectionBox = document.getElementById("selectionBox");
const selectionTextEl = document.getElementById("selectionText");

const statusLine = document.getElementById("statusLine");
const outputTextEl = document.getElementById("outputText");
const outputEmpty = document.getElementById("outputEmpty");
const skeleton = document.getElementById("skeleton");

const btnRefresh = document.getElementById("btnRefresh");
const btnClear = document.getElementById("btnClear");
const btnCopy = document.getElementById("btnCopy");

const btnExplain = document.getElementById("btnExplain");
const btnSummarize = document.getElementById("btnSummarize");
const btnQuiz = document.getElementById("btnQuiz");

const btnOpenHealth = document.getElementById("btnOpenHealth");

// State
let currentSelection = "";
let currentOutput = "";

// Helpers 
function setStatus(text, type = "neutral") {
  statusLine.textContent = text;
  statusLine.style.color =
    type === "error" ? "rgba(239,68,68,0.95)" :
    type === "ok" ? "rgba(34,197,94,0.95)" :
    "rgba(234,240,255,0.68)";
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 5000) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function setSelectionUI(text, updatedAt) {
  currentSelection = (text || "").trim();

  if (!currentSelection) {
    selectionBox.classList.add("is-empty");
    selectionTextEl.hidden = true;
    selectionTextEl.textContent = "";
    selectionMeta.textContent = "No selection yet";
    return;
  }

  selectionBox.classList.remove("is-empty");
  selectionTextEl.hidden = false;
  selectionTextEl.textContent = currentSelection;

  const meta = updatedAt ? `Updated ${timeAgo(updatedAt)}` : "Selection captured";
  selectionMeta.textContent = `${currentSelection.length} chars • ${meta}`;
}

function setOutputLoading(isLoading) {
  if (isLoading) {
    skeleton.hidden = false;
    outputEmpty.hidden = true;
    outputTextEl.hidden = true;
    btnCopy.disabled = true;
  } else {
    skeleton.hidden = true;
  }
}

function setOutput(text) {
  currentOutput = (text || "").trim();

  if (!currentOutput) {
    outputTextEl.hidden = true;
    outputEmpty.hidden = false;
    outputTextEl.textContent = "";
    btnCopy.disabled = true;
    return;
  }

  outputEmpty.hidden = true;
  outputTextEl.hidden = false;
  outputTextEl.textContent = currentOutput;
  btnCopy.disabled = false;
}

function disableActions(disabled) {
  btnExplain.disabled = disabled;
  btnSummarize.disabled = disabled;
  btnQuiz.disabled = disabled;
  btnRefresh.disabled = disabled;
  btnClear.disabled = disabled;

  const opacity = disabled ? "0.85" : "1";
  btnExplain.style.opacity = opacity;
  btnSummarize.style.opacity = opacity;
  btnQuiz.style.opacity = opacity;
}

function safeTrimForAPI(text) {
  const t = (text || "").trim();
  const max = 6000;
  if (t.length <= max) return t;
  return t.slice(0, max) + "\n\n[Trimmed for length]";
}

// Storage
async function readSelectionFromStorage() {
  const data = await chrome.storage.local.get([STORAGE_KEY, "tot_last_updated"]);
  return {
    text: (data[STORAGE_KEY] || "").trim(),
    updatedAt: data.tot_last_updated || null
  };
}

async function clearSelectionInStorage() {
  await chrome.storage.local.set({ [STORAGE_KEY]: "", tot_last_updated: Date.now() });
}

// Listen for selection updates (instant)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  const textChange = changes[STORAGE_KEY];
  const timeChange = changes["tot_last_updated"];
  if (!textChange && !timeChange) return;

  const newText = (textChange?.newValue || "").trim();
  const updatedAt = timeChange?.newValue || Date.now();
  setSelectionUI(newText, updatedAt);

  // If user had an error “No selection”, make UI feel responsive
  if (newText) setStatus("Selection captured", "ok");
});

//  Backend calls (with timeout)
async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function ensureBackendUp() {
  try {
    const r = await fetchWithTimeout(ENDPOINTS.health, { method: "GET" }, 5000);
    return r.ok;
  } catch {
    return false;
  }
}

async function callBackend(url, payload) {
  let resp;
  try {
    resp = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 25000);
  } catch (e) {
    if (String(e?.name) === "AbortError") {
      throw new Error("Request timed out. Is backend running?");
    }
    throw new Error("Network error. Backend not reachable.");
  }

  if (!resp.ok) {
    let msg = `Request failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (data?.detail) msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch (_) {}
    throw new Error(msg);
  }

  const data = await resp.json();
  return (data?.result || "").trim();
}

// Actions
async function runAction(kind) {
  const { text, updatedAt } = await readSelectionFromStorage();
  setSelectionUI(text, updatedAt);

  if (!currentSelection) {
    setStatus("Select some text on the page first.", "error");
    setOutput("");
    return;
  }

  setStatus("Checking backend…", "neutral");
  const ok = await ensureBackendUp();
  if (!ok) {
    setStatus("Backend not reachable. Start FastAPI at http://127.0.0.1:8000", "error");
    setOutput("");
    return;
  }

  disableActions(true);
  setOutputLoading(true);
  setStatus("Working…", "neutral");

  try {
    const safeText = safeTrimForAPI(currentSelection);

    let result = "";
    if (kind === "explain") {
      result = await callBackend(ENDPOINTS.explain, { text: safeText });
      setStatus("Explanation ready", "ok");
    } else if (kind === "summarize") {
      result = await callBackend(ENDPOINTS.summarize, { text: safeText });
      setStatus("Summary ready", "ok");
    } else if (kind === "quiz") {
      result = await callBackend(ENDPOINTS.quiz, { text: safeText });
      setStatus("Quiz ready", "ok");
    } else {
      throw new Error("Unknown action");
    }

    setOutput(result);
  } catch (err) {
    setStatus(err?.message || "Something went wrong", "error");
    setOutput("");
  } finally {
    setOutputLoading(false);
    disableActions(false);
  }
}

// Copy
async function copyOutput() {
  if (!currentOutput) return;
  try {
    await navigator.clipboard.writeText(currentOutput);
    setStatus("Copied to clipboard", "ok");
    setTimeout(() => setStatus("Ready", "neutral"), 1200);
  } catch {
    setStatus("Copy failed.", "error");
  }
}

// UI Events 
btnRefresh.addEventListener("click", async () => {
  setStatus("Refreshing selection…", "neutral");
  const { text, updatedAt } = await readSelectionFromStorage();
  setSelectionUI(text, updatedAt);
  setStatus(text ? "Selection updated" : "No selection yet", text ? "ok" : "neutral");
});

btnClear.addEventListener("click", async () => {
  await clearSelectionInStorage();
  setSelectionUI("", Date.now());
  setOutput("");
  setStatus("Cleared", "ok");
  setTimeout(() => setStatus("Ready", "neutral"), 900);
});

btnExplain.addEventListener("click", () => runAction("explain"));
btnSummarize.addEventListener("click", () => runAction("summarize"));
btnQuiz.addEventListener("click", () => runAction("quiz"));

btnCopy.addEventListener("click", copyOutput);

btnOpenHealth.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: ENDPOINTS.health });
});

// Initial load
(async function init() {
  setStatus("Ready", "neutral");
  const { text, updatedAt } = await readSelectionFromStorage();
  setSelectionUI(text, updatedAt);
  setOutput("");
})();
