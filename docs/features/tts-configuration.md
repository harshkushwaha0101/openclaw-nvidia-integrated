# OpenClaw Text-to-Speech (TTS) Configuration & Tuning Guide

## Overview

OpenClaw now includes a low-latency, chunked Text-to-Speech system that automatically speaks new assistant messages when enabled. The system uses the browser's Web Speech Synthesis API with smart voice selection and configurable tuning parameters.

## Quick Start

### Enable Auto-Speak

1. **Global Toggle**: Look for the speaker icon (🔊) in the chat header
2. **Click to Enable**: Click the icon to toggle auto-speak ON
3. **Status**: The icon will light up when enabled
4. **Automatic**: New assistant messages will be spoken immediately when they arrive

### Manual Speak

- **Single Message**: Click the speaker icon (🔊) next to any assistant message to speak just that message
- **Stop**: Click the speaker icon again to stop speaking

## Configuration & Tuning

### 1. Speech Rate (Speed)

**What it does**: Controls how fast the AI speaks (0.1 = very slow, 2.0 = very fast)

**Default**: 1.0 (normal speed)

**How to configure** (in browser console):

```javascript
// Import the speech module
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';

// Set to 0.8 for slower speech
setTtsConfig({ rate: 0.8 });

// Set to 1.3 for faster speech
setTtsConfig({ rate: 1.3 });

// Check current settings
localStorage.getItem('openclaw_tts_state');
```

**Recommended values**:
- **0.7-0.85**: For listening/learning (slower, easier to understand)
- **1.0**: Default comfortable speed
- **1.2-1.4**: For skimming/background (faster)

### 2. Pitch (Tone)

**What it does**: Controls the frequency/tone of the voice (0.5 = lower pitch, 2.0 = higher pitch)

**Default**: 1.0 (normal pitch)

**How to configure**:

```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';

// Lower pitch (more masculine)
setTtsConfig({ pitch: 0.7 });

// Higher pitch (more feminine)
setTtsConfig({ pitch: 1.3 });
```

**Recommended values**:
- **0.7-0.9**: Lower/deeper voice
- **1.0**: Neutral
- **1.1-1.4**: Higher/brighter voice

### 3. Volume

**What it does**: Controls output loudness (0.0 = silent, 1.0 = maximum)

**Default**: 1.0

**How to configure**:

```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';

// 70% volume
setTtsConfig({ volume: 0.7 });

// Use your system volume controls for further adjustment
```

### 4. Voice Selection & Language

**Supported Languages**:
- **Hindi (India)**: `hi-IN`
- **English (India)**: `en-IN`
- **English (US)**: `en-US`
- **English (UK)**: `en-GB`
- And many more depending on your OS/browser

**How to configure**:

```javascript
import { setTtsConfig, selectPreferredVoice } from '/ui/src/ui/chat/speech.js';

// Get available voices
const voices = window.speechSynthesis.getVoices();
console.log(voices.map(v => `${v.name} (${v.lang})`));

// The system automatically prefers female voices with Indian English preference
// You can manually select a voice by configuring the language:
setTtsConfig({ lang: 'en-IN' });
```

### 5. Chunked Speaking for Low Latency

**What it does**: Breaks long responses into small chunks and speaks them in real-time as they arrive, rather than waiting for the entire response to complete.

**Chunk Parameters** (in `speech.ts`):

```typescript
const CHUNK_THRESHOLD = 40;  // Speak when buffer reaches 40 characters
const CHUNK_TIMEOUT = 800;   // Speak every 800ms even if chunk not full
const NATURAL_PAUSE_CHARS = /[.!?:;—–-]\s+/; // Detect sentence breaks and speak immediately
```

**How latency works**:
1. Text arrives in stream → added to buffer
2. When buffer reaches ~40 characters → speak
3. When period/question mark detected → speak immediately
4. Every 800ms → speak remaining buffered text
5. When stream ends → speak any remaining text

**Tuning latency** (edit `speech.ts`):

```typescript
// For VERY fast response (but choppier):
const CHUNK_THRESHOLD = 20;  // Speak every ~20 chars
const CHUNK_TIMEOUT = 400;   // Speak every 400ms

// For LESS latency but cleaner audio:
const CHUNK_THRESHOLD = 60;  // Speak every ~60 chars
const CHUNK_TIMEOUT = 1200;  // Speak every 1.2s

// For maximum clarity (slowest response):
const CHUNK_THRESHOLD = 100; // Speak every ~100 chars
const CHUNK_TIMEOUT = 2000;  // Speak every 2s
```

## Storage & Persistence

All TTS settings are automatically saved to browser's `localStorage` under the key:

```javascript
localStorage.getItem('openclaw_tts_state')
```

**Stored fields**:

```json
{
  "autoSpeakEnabled": true,
  "config": {
    "rate": 1.0,
    "pitch": 1.0,
    "volume": 1.0,
    "lang": "en-US"
  }
}
```

To reset TTS settings to defaults:

```javascript
localStorage.removeItem('openclaw_tts_state');
location.reload();
```

## Gateway Setup - Before Starting

**No special gateway configuration is needed.** TTS runs entirely in the browser and does not require gateway changes.

However, if you want to customize TTS settings before starting your OpenClaw session:

### Option 1: Configure via Browser Console

```bash
# Start the gateway normally
pnpm openclaw gateway start

# Open browser to http://localhost:3000 (or your URL)
# Open Developer Tools (F12)
# Go to Console tab
# Paste the configuration commands below
```

Then in the browser console:

```javascript
import { setTtsConfig, setAutoSpeak, loadTtsState } from '/ui/src/ui/chat/speech.js';

// Load saved settings (if any)
loadTtsState();

// Configure speech rate (1.0 = normal)
setTtsConfig({ rate: 1.1 });

// Enable auto-speak globally
setAutoSpeak(true);
```

### Option 2: Pre-configure with Init Script

Create a file `~/.openclaw/tts-config.js`:

```javascript
// This would require hosting/serving this file
// For now, use Option 1 (browser console)
```

## Monitoring & Debugging

### Check Auto-Speak Status

```javascript
import { isAutoSpeakEnabled, getTtsState } from '/ui/src/ui/chat/speech.js';

console.log('Auto-speak enabled:', isAutoSpeakEnabled());
console.log('Current config:', getTtsState());
```

### Test Voice Selection

```javascript
import { selectPreferredVoice } from '/ui/src/ui/chat/speech.js';

const voice = selectPreferredVoice();
console.log('Selected voice:', voice?.name, `(${voice?.lang})`);

// See all available voices
console.log(window.speechSynthesis.getVoices());
```

### Test Chunked Speaking

```javascript
import { addToChunkBuffer, stopTts } from '/ui/src/ui/chat/speech.js';

// Simulate streaming text arriving
addToChunkBuffer('Hello ');
addToChunkBuffer('world! ');
addToChunkBuffer('This is a test.');

// Stop any ongoing speech
stopTts();
```

## Common Issues & Troubleshooting

### Issue: No sound is playing

**Solutions**:
1. Check browser/system volume
2. Verify TTS is supported: `'speechSynthesis' in window` → should be `true`
3. Enable auto-speak: `setAutoSpeak(true)`
4. Check console for errors: `F12` → Console tab

### Issue: Speech is too fast/slow

**Solution**: Adjust rate in console:

```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ rate: 0.9 }); // slower
setTtsConfig({ rate: 1.1 }); // faster
```

### Issue: High latency (waiting too long for speech)

**Solution**: Edit [ui/src/ui/chat/speech.ts](ui/src/ui/chat/speech.ts) and decrease chunk threshold:

```typescript
const CHUNK_THRESHOLD = 20; // was 40, now more responsive
const CHUNK_TIMEOUT = 400;  // was 800, now more frequent
```

Then rebuild: `pnpm build`

### Issue: Voice sounds wrong (male instead of female)

**Solution**: Voices are auto-selected but may vary by OS/browser. Check available voices:

```javascript
window.speechSynthesis.getVoices().forEach(v => 
  console.log(v.name, v.lang, v.default)
);
```

Then set preferred lang:

```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ lang: 'en-IN' }); // or 'hi-IN', 'en-GB', etc.
```

### Issue: TTS not respecting auto-speak setting

**Solution**: Auto-speak requires:
1. A new assistant message arrives
2. Auto-speak is enabled (`setAutoSpeak(true)`)
3. TTS is supported by your browser

Verify:

```javascript
import { isAutoSpeakEnabled, isTtsSupported } from '/ui/src/ui/chat/speech.js';
console.log('TTS supported:', isTtsSupported());
console.log('Auto-speak on:', isAutoSpeakEnabled());
```

## Performance Notes

- **CPU**: Minimal impact - speech synthesis runs in browser's native engine
- **Memory**: <5MB for TTS implementation
- **Network**: No network calls - everything local
- **Latency**: ~40-800ms from text arrival to speech start (configurable)

## Browser Compatibility

- **Chrome/Edge**: Full support ✓
- **Firefox**: Full support ✓
- **Safari**: Full support ✓
- **Mobile Chrome**: Full support ✓
- **Mobile Safari**: Full support ✓

**Note**: Voice availability varies by OS and browser. Always test on your specific platform.

## API Reference

All these functions are in `ui/src/ui/chat/speech.ts`:

```typescript
// Check support
isTtsSupported(): boolean

// Configure
setTtsConfig(config: Partial<TtsConfig>): void
setAutoSpeak(enabled: boolean): void
getTtsState(): Readonly<TtsState>

// Speak
speakText(text: string, opts?: TtsOptions): boolean
addToChunkBuffer(text: string): void
stopTts(): void
isTtsSpeaking(): boolean

// Voice selection
selectPreferredVoice(): SpeechSynthesisVoice | undefined

// State persistence
loadTtsState(): TtsState
saveTtsState(state: TtsState): void
```

## Files Involved

- **Core TTS**: [ui/src/ui/chat/speech.ts](ui/src/ui/chat/speech.ts)
- **Auto-Speak Manager**: [ui/src/ui/chat/tts-auto-speak.ts](ui/src/ui/chat/tts-auto-speak.ts)
- **UI Integration**: [ui/src/ui/chat/grouped-render.ts](ui/src/ui/chat/grouped-render.ts)
- **Chat View**: [ui/src/ui/views/chat.ts](ui/src/ui/views/chat.ts)

## Future Improvements

- [ ] Custom voice profiles (save multiple voice configs)
- [ ] Per-session TTS disable
- [ ] Streaming indicator showing what's being spoken
- [ ] Keyboard shortcuts (e.g., `Ctrl+T` to toggle auto-speak)
- [ ] TTS stats (total chars spoken, speaking time)
