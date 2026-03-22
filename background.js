chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type !== "tts") return;

  chrome.storage.sync.get("openai_api_key", async ({ openai_api_key }) => {
    if (!openai_api_key) {
      sendResponse({ error: "No API key set. Click the extension icon to configure." });
      return;
    }

    try {
      const resp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openai_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          input: msg.text,
          instructions: "Speak naturally in native Japanese.",
          language: "ja",
          response_format: "mp3",
        }),
      });

      if (!resp.ok) {
        const err = await resp.text();
        sendResponse({ error: `OpenAI API error ${resp.status}: ${err}` });
        return;
      }

      const arrayBuffer = await resp.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((s, b) => s + String.fromCharCode(b), "")
      );
      sendResponse({ audio: base64 });
    } catch (e) {
      sendResponse({ error: e.message });
    }
  });

  return true; // keep channel open for async response
});
