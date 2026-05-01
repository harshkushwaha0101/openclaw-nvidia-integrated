# TTS Quick Reference - Get Speaking in 2 Minutes

## START HERE 🎯

### Step 1: Start OpenClaw (no special setup needed)
```bash
pnpm openclaw gateway start
```

### Step 2: Open Chat
Navigate to your OpenClaw chat URL (typically `http://localhost:3000`)

### Step 3: Enable Auto-Speak
Look for the speaker icon 🔊 in the chat toolbar (top-right area, next to Send button).
- Click it once to turn ON (should light up)
- That's it!

### Step 4: Talk to OpenClaw
Send any message. The AI's response will be spoken automatically! 🎉

---

## Controls

| Action | How | Result |
|--------|-----|--------|
| **Auto-Speak Toggle** | Click 🔊 icon in toolbar | Enables/disables automatic speaking of new messages |
| **Stop Speaking** | Click 🔊 icon on any message | Stops current audio |
| **Manual Speak** | Click 🔊 icon next to a message | Speaks just that message |

---

## Tuning (In Browser Console)

Press `F12` → go to `Console` tab → paste:

### Make it SLOWER/CLEARER
```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ rate: 0.7 });
```

### Make it FASTER
```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ rate: 1.3 });
```

### Lower/Deeper Voice
```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ pitch: 0.7 });
```

### Higher/Brighter Voice
```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ pitch: 1.3 });
```

### Quieter Volume
```javascript
import { setTtsConfig } from '/ui/src/ui/chat/speech.js';
setTtsConfig({ volume: 0.7 });
```

---

## Settings Auto-Save ✓

All changes are automatically saved to your browser and will persist even after closing the browser!

To reset to defaults:
```javascript
localStorage.removeItem('openclaw_tts_state');
location.reload();
```

---

## Detailed Tuning Guide

See: **[docs/features/tts-configuration.md](docs/features/tts-configuration.md)**

This has comprehensive info on:
- Voice selection & language
- Latency optimization
- Troubleshooting
- Performance
- All available commands

---

## Need Help?

### "No sound"
1. Check volume 🔊 on your computer
2. Enable auto-speak toggle (should be lit up)
3. Send a message to trigger speaking

### "Too slow/fast"
1. Open browser console: F12
2. Run: `setTtsConfig({ rate: 1.2 })` (change 1.2 to lower/higher)

### "Wrong voice"
Voices depend on your operating system. Check what's available:
```javascript
window.speechSynthesis.getVoices().forEach(v => 
  console.log(v.name, '(' + v.lang + ')')
);
```

---

## That's It! 🎊

Enjoy hands-free ChatOps with OpenClaw!

For more details see [TTS Configuration Guide](docs/features/tts-configuration.md) or [Implementation Summary](docs/features/tts-implementation-summary.md).
