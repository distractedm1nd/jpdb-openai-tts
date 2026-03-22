// Inject a page-level script to kill jpdb's native audio before it initializes
const killScript = document.createElement("script");
killScript.textContent = `
  // Override jpdb's audio functions as soon as they're defined
  Object.defineProperty(window, 'play_audio', {
    value: function() {},
    writable: false,
    configurable: false,
  });
  Object.defineProperty(window, 'preload_audio', {
    value: function() {},
    writable: false,
    configurable: false,
  });
`;
(document.documentElement || document.head).appendChild(killScript);
killScript.remove();

// Extract clean Japanese text from an element, stripping furigana (<rt> tags)
function extractJapanese(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll("rt").forEach((rt) => rt.remove());
  return clone.textContent.trim();
}

// FIFO cache for TTS audio (base64 string keyed by text), keeps last 50 entries
const TTS_CACHE_MAX = 50;
const ttsCache = new Map();
let currentPrefetchText = null;

function ttsCacheSet(text, audio) {
  if (ttsCache.has(text)) {
    ttsCache.delete(text); // move to end
  } else if (ttsCache.size >= TTS_CACHE_MAX) {
    ttsCache.delete(ttsCache.keys().next().value);
  }
  ttsCache.set(text, audio);
}

// Request TTS and return a promise resolving to an Audio element
function fetchTTS(text) {
  if (!text) return Promise.resolve(null);

  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "tts", text }, (resp) => {
      if (chrome.runtime.lastError) {
        console.error("[jpdb-tts]", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      if (resp.error) {
        console.error("[jpdb-tts]", resp.error);
        resolve(null);
        return;
      }
      resolve(resp.audio);
    });
  });
}

function playBase64(audio) {
  if (!audio) return;
  new Audio("data:audio/mp3;base64," + audio).play();
}

// Pre-fetch sentence TTS as soon as the sentence element appears
function prefetchSentence() {
  const sentenceEl = document.querySelector(".card-sentence .sentence");
  if (!sentenceEl) return;

  let text = extractJapanese(sentenceEl);
  const jaOnly = text.replace(/[A-Za-z].*/s, "").trim();
  text = jaOnly || text;

  if (!text || text === currentPrefetchText) return;
  currentPrefetchText = text;

  console.log("[jpdb-tts] prefetching sentence:", text);
  fetchTTS(text).then((audio) => {
    if (audio) {
      ttsCacheSet(text, audio);
      console.log("[jpdb-tts] sentence cached");
    }
  });
}

// Auto-play sentence when answer is revealed
function tryAutoPlay() {
  const reveal = document.querySelector(".review-reveal");
  if (!reveal || reveal.dataset.ttsAutoPlayed) return;

  // Check if the answer is actually visible (jpdb shows it by removing a hidden class or similar)
  // The review-reveal div exists in DOM but may be hidden before reveal
  const isVisible =
    reveal.offsetParent !== null ||
    reveal.offsetHeight > 0 ||
    getComputedStyle(reveal).display !== "none";
  if (!isVisible) return;

  reveal.dataset.ttsAutoPlayed = "1";

  const sentenceEl = document.querySelector(".card-sentence .sentence");
  if (!sentenceEl) return;

  let text = extractJapanese(sentenceEl);
  const jaOnly = text.replace(/[A-Za-z].*/s, "").trim();
  text = jaOnly || text;
  if (!text) return;

  const cached = ttsCache.get(text);
  if (cached) {
    console.log("[jpdb-tts] playing cached sentence");
    playBase64(cached);
  } else {
    console.log("[jpdb-tts] cache miss, fetching sentence");
    fetchTTS(text).then(playBase64);
  }
}

// Play TTS on click (for manual button presses)
function playTTS(text) {
  if (!text) return;
  const cached = ttsCache.get(text);
  if (cached) {
    playBase64(cached);
  } else {
    fetchTTS(text).then((audio) => {
      if (audio) {
        ttsCacheSet(text, audio);
        playBase64(audio);
      }
    });
  }
}

// Intercept audio link clicks
function hookAudioLinks() {
  document.querySelectorAll(".vocabulary-audio, .example-audio").forEach((el) => {
    if (el.dataset.ttsHooked) return;
    el.dataset.ttsHooked = "1";

    // Disable jpdb's native audio so it doesn't overlap
    el.removeAttribute("data-audio");
    el.removeAttribute("data-audio-autoplay");
    el.removeAttribute("data-audio-preload");
    el.removeAttribute("onclick");

    el.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        let text = "";

        if (el.classList.contains("vocabulary-audio")) {
          const plain = document.querySelector(".answer-box .plain");
          if (plain) {
            text = extractJapanese(plain);
          }
        } else if (el.classList.contains("example-audio")) {
          const sentenceEl =
            el.closest(".sentence") || el.closest(".card-sentence");
          if (sentenceEl) {
            text = extractJapanese(sentenceEl);
          } else {
            const parent = el.parentElement;
            const container =
              parent.closest(".subsection") || parent.closest(".card-sentence");
            if (container) {
              const jp = container.querySelector(".jp, .sentence");
              if (jp) text = extractJapanese(jp);
            }
          }
        }

        if (text) {
          const jaOnly = text.replace(/[A-Za-z].*/s, "").trim();
          playTTS(jaOnly || text);
        }
      },
      true
    );
  });
}

// Reset prefetch state when card changes
let lastCardText = null;
function onCardChange() {
  const plain = document.querySelector(".answer-box .plain, .review-reveal .plain");
  const newText = plain ? plain.textContent : null;
  if (newText !== lastCardText) {
    lastCardText = newText;
    currentPrefetchText = null;
  }
}

// Wait for DOM before hooking elements (we run at document_start now)
function init() {
  const observer = new MutationObserver(() => {
    onCardChange();
    prefetchSentence();
    hookAudioLinks();
    tryAutoPlay();
  });

  observer.observe(document.body, { childList: true, subtree: true });

  prefetchSentence();
  hookAudioLinks();
  tryAutoPlay();

  console.log("[jpdb-tts] OpenAI TTS extension loaded");
}

if (document.body) {
  init();
} else {
  document.addEventListener("DOMContentLoaded", init);
}
