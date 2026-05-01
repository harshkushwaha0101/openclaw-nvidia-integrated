/**
 * Browser-native speech services: STT via SpeechRecognition, TTS via SpeechSynthesis.
 * Falls back gracefully when APIs are unavailable.
 */

// ─── STT (Speech-to-Text) ───

type SpeechRecognitionEvent = Event & {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & {
  error: string;
  message?: string;
};

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = globalThis as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as SpeechRecognitionCtor | null;
}

export function isSttSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

export type SttCallbacks = {
  onTranscript: (text: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  // Auto-send integration callbacks
  onAutoSendStart?: () => void;
  onAutoSendTranscript?: (text: string, isFinal: boolean) => void;
  onAutoSendSilenceDetected?: (silenceDurationMs: number) => void;
  onAutoSendSpeechResumes?: () => void;
};

let activeRecognition: SpeechRecognitionInstance | null = null;
let autoSendState: {
  lastUpdateTime: number;
  isSilent: boolean;
  silenceStartTime: number | null;
  silenceCheckTimer: number | null;
} = {
  lastUpdateTime: 0,
  isSilent: false,
  silenceStartTime: null,
  silenceCheckTimer: null,
};

export function startStt(callbacks: SttCallbacks): boolean {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) {
    callbacks.onError?.("Speech recognition is not supported in this browser");
    return false;
  }

  stopStt();

  // Initialize auto-send state
  autoSendState.lastUpdateTime = Date.now();
  autoSendState.isSilent = false;
  autoSendState.silenceStartTime = null;

  const recognition = new Ctor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  recognition.addEventListener("start", () => {
    autoSendState.lastUpdateTime = Date.now();
    callbacks.onAutoSendStart?.();
    callbacks.onStart?.();
  });

  recognition.addEventListener("result", (event) => {
    const speechEvent = event as unknown as SpeechRecognitionEvent;
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = speechEvent.resultIndex; i < speechEvent.results.length; i++) {
      const result = speechEvent.results[i];
      if (!result?.[0]) {
        continue;
      }
      const transcript = result[0].transcript;
      if (result.isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      callbacks.onTranscript(finalTranscript, true);
      // Auto-send: notify about final transcript
      autoSendState.lastUpdateTime = Date.now();
      autoSendState.isSilent = false;
      if (autoSendState.silenceStartTime !== null) {
        callbacks.onAutoSendSpeechResumes?.();
      }
      autoSendState.silenceStartTime = null;
      callbacks.onAutoSendTranscript?.(finalTranscript, true);
    } else if (interimTranscript) {
      callbacks.onTranscript(interimTranscript, false);
      // Auto-send: notify about interim transcript (user still speaking)
      autoSendState.lastUpdateTime = Date.now();
      autoSendState.isSilent = false;
      if (autoSendState.silenceStartTime !== null) {
        callbacks.onAutoSendSpeechResumes?.();
      }
      autoSendState.silenceStartTime = null;
      callbacks.onAutoSendTranscript?.(interimTranscript, false);
    }
  });

  // Auto-send: Monitor for silence between speech events
  autoSendState.silenceCheckTimer = window.setInterval(() => {
    const now = Date.now();
    const timeSinceUpdate = now - autoSendState.lastUpdateTime;
    const silenceThreshold = 500; // Begin tracking silence after 500ms no updates

    if (timeSinceUpdate >= silenceThreshold && !autoSendState.isSilent) {
      // Silence just started
      autoSendState.isSilent = true;
      autoSendState.silenceStartTime = now;
      console.log("[STT-AUTO-SEND] Silence detected");
    }

    if (autoSendState.isSilent && autoSendState.silenceStartTime !== null) {
      const silenceDuration = now - autoSendState.silenceStartTime;
      callbacks.onAutoSendSilenceDetected?.(silenceDuration);
    }
  }, 100) as unknown as number; // Check every 100ms

  recognition.addEventListener("error", (event) => {
    const speechEvent = event as unknown as SpeechRecognitionErrorEvent;
    if (speechEvent.error === "aborted" || speechEvent.error === "no-speech") {
      return;
    }
    callbacks.onError?.(speechEvent.error);
  });

  recognition.addEventListener("end", () => {
    if (activeRecognition === recognition) {
      activeRecognition = null;
    }
    // Stop silence monitoring
    if (autoSendState.silenceCheckTimer !== null) {
      clearInterval(autoSendState.silenceCheckTimer);
      autoSendState.silenceCheckTimer = null;
    }
    callbacks.onEnd?.();
  });

  activeRecognition = recognition;
  recognition.start();
  return true;
}

export function stopStt(): void {
  if (activeRecognition) {
    const r = activeRecognition;
    activeRecognition = null;
    try {
      r.stop();
    } catch {
      // already stopped
    }
  }
  // Clean up auto-send silence monitoring
  if (autoSendState.silenceCheckTimer !== null) {
    clearInterval(autoSendState.silenceCheckTimer);
    autoSendState.silenceCheckTimer = null;
  }
}

export function isSttActive(): boolean {
  return activeRecognition !== null;
}

// ─── TTS (Text-to-Speech) ───

export interface TtsConfig {
  /** Speech rate (0.1 - 10, default 1.0) - lower = slower */
  rate?: 1.3;
  /** Pitch (0 - 2, default 1.0) - affects tone */
  pitch?: number;
  /** Volume (0 - 1, default 1.0) */
  volume?: 1.0;
  /** Preferred language code (e.g., 'hi-IN', 'en-IN', 'en-US') */
  lang?: string;
}

export interface TtsState {
  autoSpeakEnabled: boolean;
  lastSpokenMessageId?: string;
  config: TtsConfig;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let ttsState: TtsState = {
  autoSpeakEnabled: true, // Enabled by default since toggle button removed
  config: {
    rate: 1.3,
    pitch: 1.0,
    volume: 1.0,
    lang: "en-US",
  },
};

// Voice caching and loading
let cachedPreferredVoice: SpeechSynthesisVoice | undefined = undefined;
let voicesLoaded = false;

// Speech queue system - queue utterances instead of canceling
let speechQueue: SpeechSynthesisUtterance[] = [];
let isPlayingQueue = false;

// Buffered chunk speaking for low latency
let chunkBuffer = "";
let chunkTimer: number | null = null;
const CHUNK_THRESHOLD = 180; // characters - triggers speech (increased for more natural phrases)
const CHUNK_TIMEOUT = 1200; // ms - speak even if buffer not full (increased to avoid frequent chunks)
const NATURAL_PAUSE_CHARS = /[.!?]\s+/; // triggers immediate speak (only sentence-ending punctuation, not : or ;)

export function isTtsSupported(): boolean {
  return "speechSynthesis" in globalThis;
}

/**
 * Initialize TTS voice loading and listeners.
 * Call this once when the app initializes to ensure voices are ready.
 */
export function initializeTtsVoices(): void {
  if (!isTtsSupported()) {
    return;
  }

  // Log all available voices to help debug
  const voices = speechSynthesis.getVoices();
  console.log(`[TTS] Total voices available: ${voices.length}`);
  
  // Group and display voices by language
  const voicesByLang: Record<string, string[]> = {};
  voices.forEach(v => {
    if (!voicesByLang[v.lang]) voicesByLang[v.lang] = [];
    voicesByLang[v.lang].push(`${v.name} (${v.lang})`);
  });
  
  console.log("[TTS] Voices grouped by language:");
  Object.entries(voicesByLang).forEach(([lang, names]) => {
    console.log(`  ${lang}: ${names.join(", ")}`);
  });

  // Perform initial voice selection
  cachedPreferredVoice = _selectPreferredVoiceImpl();
  voicesLoaded = true;

  // Listen for when voices finish loading in the browser
  const voicesChangedHandler = () => {
    console.log("[TTS] voiceschanged event fired");
    const newVoice = _selectPreferredVoiceImpl();
    if (newVoice && newVoice !== cachedPreferredVoice) {
      console.log("[TTS] Voice selection changed to:", newVoice.name);
      cachedPreferredVoice = newVoice;
    }
  };
  
  speechSynthesis.addEventListener("voiceschanged", voicesChangedHandler);
}

/**
 * Internal implementation of voice selection.
 * Prioritizes female voices with Indian English preference.
 * Returns the exact voice object to use.
 */
function _selectPreferredVoiceImpl(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    console.warn("[TTS] No voices available");
    return undefined;
  }

  console.log(`[TTS] Searching for preferred voice among ${voices.length} available`);

  // Known good Indian female voices (prioritized by quality)
  const knownGoodVoices = [
    // 🥇 Top Tier (Best for Hinglish + Natural Female Voice)
{ name: "PriyaNeural", lang: "en-IN" },
{ name: "Neerja", lang: "en-IN" },

// 👍 Good Tier
{ name: "Google हिन्दी", lang: "hi-IN" },
{ name: "Google हिंदी", lang: "hi-IN" },
{ name: "Priya", lang: "en-IN" },

// 🤏 Okay / Fallback
{ name: "Lekha", lang: "hi-IN" },
{ name: "Ojaswini", lang: "hi-IN" },
{ name: "Chitrangi", lang: "hi-IN" },
{ name: "Shruti", lang: "hi-IN" },
  ];

  // PRIORITY 1: Look for exactly matching known good voices
  for (const knownVoice of knownGoodVoices) {
    const found = voices.find(v => 
      v.name === knownVoice.name && v.lang.startsWith(knownVoice.lang)
    );
    if (found) {
      console.log("[TTS] ✓ Selected known good voice:", found.name, `(${found.lang})`);
      return found;
    }
  }

  // PRIORITY 2: hi-IN female voices
  const hiIndianFemale = voices.filter((v) => {
    const isHindi = v.lang === "hi-IN" || v.lang.startsWith("hi-IN-");
    const isFemale = 
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("woman") ||
      v.name.toLowerCase().includes("girl") ||
      // Common female Indian voice names
      ["Lekha", "Ojaswini", "Chitrangi", "Shruti", "Priya", "Neerja"].some(n => v.name.includes(n));
    return isHindi && isFemale;
  });
  if (hiIndianFemale.length > 0) {
    console.log("[TTS] ✓ Selected hi-IN female voice:", hiIndianFemale[0].name, `(${hiIndianFemale[0].lang})`);
    return hiIndianFemale[0];
  }

  // PRIORITY 3: en-IN female voices
  const enIndianFemale = voices.filter((v) => {
    const isEnglishIndia = v.lang === "en-IN" || v.lang.startsWith("en-IN-");
    const isFemale = 
      v.name.toLowerCase().includes("female") ||
      v.name.toLowerCase().includes("woman") ||
      v.name.toLowerCase().includes("girl") ||
      // Common female Indian voice names
      ["Priya", "Neerja", "Shruti"].some(n => v.name.includes(n));
    return isEnglishIndia && isFemale;
  });
  if (enIndianFemale.length > 0) {
    console.log("[TTS] ✓ Selected en-IN female voice:", enIndianFemale[0].name, `(${enIndianFemale[0].lang})`);
    return enIndianFemale[0];
  }

  // PRIORITY 4: Any hi-IN voice
  const hiIndian = voices.filter((v) => v.lang === "hi-IN" || v.lang.startsWith("hi-IN-"));
  if (hiIndian.length > 0) {
    const female = hiIndian.find(v => 
      v.name.toLowerCase().includes("female") || 
      v.name.toLowerCase().includes("woman")
    );
    const selected = female || hiIndian[0];
    console.log("[TTS] ⚠ Selected hi-IN voice (any gender):", selected.name, `(${selected.lang})`);
    return selected;
  }

  // PRIORITY 5: Any en-IN voice
  const enIndian = voices.filter((v) => v.lang === "en-IN" || v.lang.startsWith("en-IN-"));
  if (enIndian.length > 0) {
    const female = enIndian.find(v => 
      v.name.toLowerCase().includes("female") || 
      v.name.toLowerCase().includes("woman")
    );
    const selected = female || enIndian[0];
    console.log("[TTS] ⚠ Selected en-IN voice (any gender):", selected.name, `(${selected.lang})`);
    return selected;
  }

  // PRIORITY 6: Female voice in any English variant
  const anyEnglishFemale = voices.find((v) =>
    (v.lang.startsWith("en-") || v.lang === "en") &&
    (v.name.toLowerCase().includes("female") ||
     v.name.toLowerCase().includes("woman"))
  );
  if (anyEnglishFemale) {
    console.log("[TTS] ⚠⚠ Selected English female voice (fallback):", anyEnglishFemale.name, `(${anyEnglishFemale.lang})`);
    return anyEnglishFemale;
  }

  // PRIORITY 7: Any female voice
  const anyFemale = voices.find((v) =>
    v.name.toLowerCase().includes("female") ||
    v.name.toLowerCase().includes("woman") ||
    v.name.toLowerCase().includes("girl")
  );
  if (anyFemale) {
    console.log("[TTS] ⚠⚠ Selected any female voice (fallback):", anyFemale.name, `(${anyFemale.lang})`);
    return anyFemale;
  }

  // PRIORITY 8: First available
  console.warn("[TTS] ⚠⚠⚠ Using first available voice (last resort):", voices[0].name, `(${voices[0].lang})`);
  return voices[0];
}

/**
 * Get the preferred voice for speaking, using cached selection.
 * Falls back to dynamic selection if cache is empty.
 */
export function selectPreferredVoice(): SpeechSynthesisVoice | undefined {
  if (!isTtsSupported()) {
    return undefined;
  }

  // If we haven't initialized yet, do it now
  if (!voicesLoaded) {
    initializeTtsVoices();
  }

  // Return cached voice if available
  if (cachedPreferredVoice) {
    return cachedPreferredVoice;
  }

  // Fallback to dynamic selection
  const voice = _selectPreferredVoiceImpl();
  if (voice) {
    cachedPreferredVoice = voice;
  }
  return voice;
}

/**
 * Load TTS state from localStorage
 */
export function loadTtsState(): TtsState {
  if (!isTtsSupported()) {
    return ttsState;
  }

  try {
    const stored = localStorage.getItem("openclaw_tts_state");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<TtsState>;
      ttsState = {
        autoSpeakEnabled: parsed.autoSpeakEnabled ?? false,
        config: {
          rate: parsed.config?.rate ?? 1.3,
          pitch: parsed.config?.pitch ?? 1.0,
          volume: parsed.config?.volume ?? 1.0,
          lang: parsed.config?.lang ?? "en-US",
        },
      };
    }
  } catch {
    // Ignore parse errors, use defaults
  }

  return ttsState;
}

/**
 * Persist TTS state to localStorage
 */
export function saveTtsState(state: TtsState): void {
  if (!isTtsSupported()) {
    return;
  }
  try {
    localStorage.setItem("openclaw_tts_state", JSON.stringify(state));
    ttsState = state;
  } catch {
    // Ignore storage errors
  }
}

/**
 * Initialize TTS system: load state from localStorage and prepare voices.
 * Call this once on app startup to ensure TTS is ready.
 */
export function initializeTts(): void {
  if (!isTtsSupported()) {
    return;
  }

  // Load persisted TTS state from localStorage
  loadTtsState();

  // Initialize voice loading with voiceschanged listener
  initializeTtsVoices();

  console.log("[TTS] Initialized. Auto-speak enabled:", ttsState.autoSpeakEnabled);
}

/**
 * Get current TTS configuration and state
 */
export function getTtsState(): Readonly<TtsState> {
  return { ...ttsState };
}

/**
 * Update TTS configuration (rate, pitch, volume, lang)
 */
export function setTtsConfig(config: Partial<TtsConfig>): void {
  ttsState.config = {
    ...ttsState.config,
    ...config,
  };
  saveTtsState(ttsState);
}

/**
 * Enable or disable auto-speak globally
 */
export function setAutoSpeak(enabled: boolean): void {
  ttsState.autoSpeakEnabled = enabled;
  saveTtsState(ttsState);
}

/**
 * Check if auto-speak is enabled
 */
export function isAutoSpeakEnabled(): boolean {
  return ttsState.autoSpeakEnabled;
}

/**
 * Flush any buffered chunk and optionally speak it (queue-based)
 */
function flushChunkBuffer(): void {
  if (chunkTimer) {
    clearTimeout(chunkTimer);
    chunkTimer = null;
  }
  if (chunkBuffer.trim()) {
    const toSpeak = chunkBuffer.trim();
    chunkBuffer = "";
    queueSpeak(toSpeak); // Use queue instead of immediate speak
  }
}

/**
 * Speak complete finalized text with unified behavior.
 * Used when the entire message is available (e.g., after streaming completes).
 * Flushes chunk buffer and speaks the complete text as one utterance.
 */
export function speakCompleteText(
  text: string,
  opts?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
  },
): boolean {
  // Flush any remaining chunks
  flushChunkBuffer();
  
  // Speak the complete text using the same logic as manual TTS
  return speakText(text, opts);
}

/**
 * Process the speech queue - speak next item when current finishes
 */
function playNextInQueue(): void {
  if (speechQueue.length === 0) {
    console.log("[TTS-QUEUE] Queue is empty, stopping playback");
    isPlayingQueue = false;
    currentUtterance = null;
    return;
  }

  const utterance = speechQueue.shift();
  if (!utterance) {
    console.warn("[TTS-QUEUE] Failed to get utterance from queue");
    isPlayingQueue = false;
    return;
  }

  isPlayingQueue = true;
  currentUtterance = utterance;
  
  console.log(`[TTS-QUEUE] Playing from queue. Remaining: ${speechQueue.length}`);
  speechSynthesis.speak(utterance);
}

/**
 * Add text to the speech queue (will be spoken after current speech ends)
 * This ensures sequential speaking without interruptions
 */
function queueSpeak(text: string): boolean {
  if (!isTtsSupported()) {
    console.warn("[TTS-QUEUE] Browser does not support speech synthesis");
    return false;
  }

  const cleaned = stripMarkdown(text);
  if (!cleaned.trim()) {
    console.warn("[TTS-QUEUE] Cleaned text is empty, not queueing");
    return false;
  }

  const utterance = new SpeechSynthesisUtterance(cleaned);
  
  // Get and apply the preferred voice
  const voice = selectPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    console.log("[TTS-QUEUE] Applied voice to utterance:", voice.name, `(${voice.lang})`);
  } else {
    console.warn("[TTS-QUEUE] No voice available, using browser default");
  }

  // Apply TTS configuration
  utterance.rate = (ttsState.config.rate ?? 1.2) + 0.05;
  utterance.pitch = ttsState.config.pitch ?? 1.0;
  utterance.volume = ttsState.config.volume ?? 1.0;

  // Add event listeners
  utterance.addEventListener("start", () => {
    console.log("[TTS-QUEUE] Utterance started speaking");
  });

  utterance.addEventListener("end", () => {
    console.log("[TTS-QUEUE] Utterance ended");
    playNextInQueue(); // Play next when this ends
  });

  utterance.addEventListener("error", (e) => {
    console.error("[TTS-QUEUE] Utterance error:", e.error);
    playNextInQueue(); // Move to next even on error
  });

  // Add to queue
  speechQueue.push(utterance);
  console.log(`[TTS-QUEUE] Queued utterance. Queue size: ${speechQueue.length}, text: "${cleaned.substring(0, 50)}${cleaned.length > 50 ? "..." : ""}"`);

  // If not already playing, start the queue
  if (!isPlayingQueue) {
    console.log("[TTS-QUEUE] Queue was empty, starting playback");
    playNextInQueue();
  }

  return true;
}

/**
 * Add text to buffer and speak when chunk threshold reached or timeout occurs
 * Uses queue system to avoid interrupting current speech
 */
export function addToChunkBuffer(text: string): void {
  if (!isTtsSupported()) {
    return;
  }

  chunkBuffer += text;

  // Clear existing timer
  if (chunkTimer) {
    clearTimeout(chunkTimer);
  }

  // Check for natural pause (period, exclamation, question mark, etc.)
  if (NATURAL_PAUSE_CHARS.test(chunkBuffer)) {
    const match = chunkBuffer.match(NATURAL_PAUSE_CHARS);
    if (match && match.index !== undefined) {
      const pauseIdx = match.index + match[0].length;
      const toSpeak = chunkBuffer.substring(0, pauseIdx).trim();
      chunkBuffer = chunkBuffer.substring(pauseIdx);
      if (toSpeak) {
        queueSpeak(toSpeak); // Use queue instead of immediate
      }
      // Schedule timer for remaining buffer
      if (chunkBuffer.trim()) {
        chunkTimer = window.setTimeout(() => flushChunkBuffer(), CHUNK_TIMEOUT);
      }
      return;
    }
  }

  // Speak if buffer reaches threshold
  if (chunkBuffer.length >= CHUNK_THRESHOLD) {
    const toSpeak = chunkBuffer.trim();
    chunkBuffer = "";
    queueSpeak(toSpeak); // Use queue instead of immediate
    return;
  }

  // Otherwise set timeout to speak remaining
  chunkTimer = window.setTimeout(() => flushChunkBuffer(), CHUNK_TIMEOUT);
}

/**
 * Speak text immediately (one-shot, non-chunked, uses queue system)
 */
export function speakText(
  text: string,
  opts?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: string) => void;
  },
): boolean {
  if (!isTtsSupported()) {
    const msg = "Speech synthesis is not supported in this browser";
    console.error("[TTS-SPEAK] Browser does not support speech synthesis");
    opts?.onError?.(msg);
    return false;
  }

  const cleaned = stripMarkdown(text);
  if (!cleaned.trim()) {
    console.warn("[TTS-SPEAK] Cleaned text is empty");
    return false;
  }

  console.log("[TTS-SPEAK] Creating utterance for:", cleaned.substring(0, 60) + (cleaned.length > 60 ? "..." : ""));

  const utterance = new SpeechSynthesisUtterance(cleaned);
  
  // Get and apply the preferred voice - CRITICAL
  const voice = selectPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    console.log("[TTS-SPEAK] Applied voice:", voice.name, `(${voice.lang})`);
  } else {
    console.warn("[TTS-SPEAK] No voice selected, using browser default");
  }

  // Apply TTS configuration
  utterance.rate = (ttsState.config.rate ?? 1.2) + 0.05;
  utterance.pitch = ttsState.config.pitch ?? 1.0;
  utterance.volume = ttsState.config.volume ?? 1.0;

  utterance.addEventListener("start", () => {
    console.log("[TTS-SPEAK] Speech started");
    opts?.onStart?.();
  });

  utterance.addEventListener("end", () => {
    console.log("[TTS-SPEAK] Speech ended");
    if (currentUtterance === utterance) {
      currentUtterance = null;
    }
    opts?.onEnd?.();
    playNextInQueue(); // Play next after this one ends
  });

  utterance.addEventListener("error", (e) => {
    console.error("[TTS-SPEAK] Speech error:", e.error);
    if (currentUtterance === utterance) {
      currentUtterance = null;
    }
    if (e.error !== "canceled" && e.error !== "interrupted") {
      opts?.onError?.(e.error);
    }
    playNextInQueue(); // Play next even on error
  });

  currentUtterance = utterance;
  console.log("[TTS-SPEAK] Calling speechSynthesis.speak()");
  speechSynthesis.speak(utterance);
  return true;
}

export function stopTts(): void {
  console.log("[TTS-STOP] Stopping all TTS");
  
  if (chunkTimer) {
    clearTimeout(chunkTimer);
    chunkTimer = null;
    console.log("[TTS-STOP] Cleared chunk timer");
  }
  
  chunkBuffer = "";
  
  // Clear speech queue
  const queueSize = speechQueue.length;
  speechQueue = [];
  isPlayingQueue = false;
  
  if (currentUtterance) {
    currentUtterance = null;
  }
  
  if (isTtsSupported()) {
    speechSynthesis.cancel();
    console.log("[TTS-STOP] Called speechSynthesis.cancel()");
  }
  
  console.log(`[TTS-STOP] Stopped TTS. Cleared ${queueSize} queued utterances`);
}

export function isTtsSpeaking(): boolean {
  return isTtsSupported() && speechSynthesis.speaking;
}

/**
 * Remove emojis and special Unicode characters that shouldn't be spoken.
 * Keeps only actual text content.
 */
function removeEmojisAndSpecialChars(text: string): string {
  let cleaned = text;
  
  // Remove emoji ranges (comprehensive Unicode emoji pattern)
  cleaned = cleaned
    // Emoticons (😀😁😂 etc) - U+1F600–U+1F64F
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    // Symbols & Pictographs - U+1F300–U+1F5FF
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    // Transport & Map - U+1F680–U+1F6FF
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    // Supplemental Symbols - U+1F900–U+1F9FF
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, "")
    // Miscellaneous Symbols - U+2600–U+26FF
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    // Dingbats - U+2700–U+27BF
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    // Miscellaneous Technical - U+2300–U+23FF
    .replace(/[\u{2300}-\u{23FF}]/gu, "")
    // Emoticons - U+1F1E0–U+1F1FF (flags)
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    // Variation selectors
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "")
    // Zero-width joiner
    .replace(/[\u{200D}]/gu, "")
    // Zero-width characters
    .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    .trim();
  
  if (text !== cleaned) {
    console.log("[TTS-CLEAN] Removed emojis/special chars. Before:", text.substring(0, 60), "→ After:", cleaned.substring(0, 60));
  }
  
  return cleaned;
}

/** Strip common markdown syntax for cleaner speech output. */
function stripMarkdown(text: string): string {
  // First remove emojis and special characters
  let cleaned = removeEmojisAndSpecialChars(text);
  
  return (
    cleaned
      // code blocks
      .replace(/```[\s\S]*?```/g, "")
      // inline code
      .replace(/`[^`]+`/g, "")
      // images
      .replace(/!\[.*?\]\(.*?\)/g, "")
      // links → keep text
      .replace(/\[([^\]]+)\]\(.*?\)/g, "$1")
      // headings
      .replace(/^#{1,6}\s+/gm, "")
      // bold/italic
      .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
      .replace(/_{1,3}(.*?)_{1,3}/g, "$1")
      // blockquotes
      .replace(/^>\s?/gm, "")
      // horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, "")
      // list markers
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/^\s*\d+\.\s+/gm, "")
      // HTML tags
      .replace(/<[^>]+>/g, "")
      // collapse whitespace
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}
