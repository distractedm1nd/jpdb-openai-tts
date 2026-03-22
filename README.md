# jpdb OpenAI TTS

A Chrome extension that replaces [jpdb.io](https://jpdb.io)'s built-in audio with OpenAI TTS (`gpt-4o-mini-tts`, Alloy voice).

## Features

- Intercepts jpdb's native audio and plays OpenAI-generated speech instead
- Pre-fetches sentence audio for instant playback on card reveal
- Auto-plays sentence TTS when the answer is shown during reviews
- Caches recent audio (up to 50 entries) to minimize API calls

## Setup

1. Load this directory as an unpacked Chrome extension
2. Click the extension icon and enter your OpenAI API key
