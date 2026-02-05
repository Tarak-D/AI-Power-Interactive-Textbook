// content.js (MVP but reliable)
// Fixes:
// Works inside iframes (enabled by manifest all_frames:true)
// Captures selection in normal text AND in inputs/textareas
// Sends only when selection changes (reduces spam)

let debounceTimer = null;
let lastSent = "";

function getSelectedFromInputs() {
  const el = document.activeElement;
  if (!el) return "";

  const tag = (el.tagName || "").toLowerCase();
  const isTextArea = tag === "textarea";
  const isTextInput = tag === "input" && (el.type === "text" || el.type === "search" || el.type === "email" || el.type === "url" || el.type === "tel" || el.type === "password");

  if (!isTextArea && !isTextInput) return "";

  const start = el.selectionStart;
  const end = el.selectionEnd;

  if (typeof start !== "number" || typeof end !== "number") return "";
  if (start === end) return "";

  return (el.value || "").slice(start, end).trim();
}

function getSelectedFromPage() {
  const sel = window.getSelection?.();
  const text = sel ? sel.toString() : "";
  return (text || "").trim();
}

function getSelectedText() {
  // Prefer input/textarea selection if any
  const t1 = getSelectedFromInputs();
  if (t1) return t1;

  // Otherwise normal page selection
  return getSelectedFromPage();
}

function sendSelection(text) {
  chrome.runtime.sendMessage({ type: "SELECTION_CAPTURED", text }, () => {
    // Some pages may restrict extension injection; ignore quietly
    if (chrome.runtime.lastError) return;
  });
}

function captureSelection() {
  const text = getSelectedText();
  if (!text || text.length < 3) return;

  // Only send if changed
  if (text === lastSent) return;
  lastSent = text;

  sendSelection(text);
}

function debounceCapture() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(captureSelection, 180);
}

// Mouse selection end
document.addEventListener("mouseup", debounceCapture, { passive: true });

// Keyboard selection end (Shift+Arrow etc.)
document.addEventListener("keyup", (e) => {
  const keys = ["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
  if (keys.includes(e.key)) debounceCapture();
}, { passive: true });

// Double click word selection
document.addEventListener("dblclick", debounceCapture, { passive: true });

// Extra: some sites update selection on focus change
document.addEventListener("selectionchange", () => {
  // very light debounce so it doesn’t spam
  debounceCapture();
});
