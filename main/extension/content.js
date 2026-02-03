let selectedText = "";

document.addEventListener("mouseup", () => {
  selectedText = window.getSelection().toString();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_SELECTION") {
    sendResponse({ text: selectedText });
  }
});