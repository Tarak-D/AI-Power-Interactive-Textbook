// service_worker.js (Manifest V3)
// 1) content.js
// 2) chrome.storage (side panel)
// 3) side panel

const STORAGE_KEY = "tot_selected_text";

// Open side panel when user clicks extension icon
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return;
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error("Failed to open side panel:", err);
  }
});

// Listen to messages from content script or side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (!message || !message.type) {
        sendResponse({ ok: false, error: "Invalid message" });
        return;
      }

      // From content script: store the latest highlighted text
      if (message.type === "SELECTION_CAPTURED") {
        const text = (message.text || "").trim();
        await chrome.storage.local.set({ [STORAGE_KEY]: text, tot_last_updated: Date.now() });
        sendResponse({ ok: true });
        return;
      }

      // From side panel: ask for the latest stored selection
      if (message.type === "GET_SELECTION") {
        const data = await chrome.storage.local.get([STORAGE_KEY, "tot_last_updated"]);
        sendResponse({
          ok: true,
          text: data[STORAGE_KEY] || "",
          updatedAt: data.tot_last_updated || null
        });
        return;
      }

      // From side panel: allow clearing selection
      if (message.type === "CLEAR_SELECTION") {
        await chrome.storage.local.set({ [STORAGE_KEY]: "", tot_last_updated: Date.now() });
        sendResponse({ ok: true });
        return;
      }

      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (err) {
      console.error("service_worker error:", err);
      sendResponse({ ok: false, error: String(err?.message || err) });
    }
  })();

  // IMPORTANT: keep the message channel open for async sendResponse
  return true;
});
