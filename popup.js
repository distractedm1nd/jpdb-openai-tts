const keyInput = document.getElementById("key");
const saveBtn = document.getElementById("save");
const status = document.getElementById("status");

chrome.storage.sync.get("openai_api_key", ({ openai_api_key }) => {
  if (openai_api_key) {
    keyInput.value = openai_api_key;
    status.textContent = "Key saved.";
  }
});

saveBtn.addEventListener("click", () => {
  const key = keyInput.value.trim();
  if (!key) {
    status.textContent = "Please enter a key.";
    return;
  }
  chrome.storage.sync.set({ openai_api_key: key }, () => {
    status.textContent = "Saved!";
  });
});
