document.getElementById("explain").addEventListener("click", async () => {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" }, async (response) => {
    if (!response || !response.text) {
      document.getElementById("result").innerText = "Please select some text first.";
      return;
    }

    const res = await fetch("http://127.0.0.1:8000/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: response.text })
    });

    const data = await res.json();

    document.getElementById("result").innerText = data.result || data.error;
  });
});