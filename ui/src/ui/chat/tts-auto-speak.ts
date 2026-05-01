/**
 * Auto-speak manager for OpenClaw chat.
 * Automatically speaks final assistant messages when auto-speak is enabled.
 * Only speaks visible assistant message content, not tool calls or system messages.
 * Uses unified TTS behavior: same logic, config, and voice as manual per-message TTS.
 */

import { addToChunkBuffer, isAutoSpeakEnabled, isTtsSupported, stopTts, speakCompleteText } from "./speech.js";
import { extractTextCached } from "./message-extract.js";

let lastAutoSpokenMessageId: string | null = null;
let currentStreamText = "";
let isStreamInProgress = false;
/**
 * Initialize auto-speak listener for streaming updates.
 * Call this once when the chat UI mounts.
 */
export function initAutoSpeakListener(): void {
  if (!isTtsSupported()) {
    return;
  }

  // Load previous state
  try {
    const stored = localStorage.getItem("openclaw_tts_last_spoken");
    if (stored) {
      lastAutoSpokenMessageId = stored;
    }
  } catch {
    // Ignore
  }
}

/**
 * Call this when streaming text arrives (in real-time)
 * Buffers text for chunked speaking if auto-speak is on
 */
export function onStreamChunk(text: string): void {
  if (!isAutoSpeakEnabled() || !isTtsSupported()) {
    return;
  }

  isStreamInProgress = true;
  currentStreamText += text;
  // Use buffered chunking for smooth, continuous speech during streaming
  addToChunkBuffer(text);
}

/**
 * Call this when a new assistant message is fully rendered
 * (after stream completes or message is finalized)
 * 
 * UNIFIED BEHAVIOR: Uses speakCompleteText which ensures the same logic,
 * voice, rate, pitch, and volume as manual per-message TTS.
 * If streaming is still in progress, flushes the chunk buffer first.
 * If streaming is complete, speaks the entire message as one utterance
 * (avoiding sentence-by-sentence playback).
 */
export function onAssistantMessageComplete(messageId: string, message: unknown): void {
  if (!isAutoSpeakEnabled() || !isTtsSupported()) {
    return;
  }

  // Don't re-speak the same message
  if (lastAutoSpokenMessageId === messageId) {
    return;
  }

  // Extract visible text from message
  const text = extractTextCached(message);
  if (!text?.trim()) {
    return;
  }

  // Mark as spoken
  lastAutoSpokenMessageId = messageId;
  isStreamInProgress = false;
  currentStreamText = "";
  
  try {
    localStorage.setItem("openclaw_tts_last_spoken", messageId);
  } catch {
    // Ignore storage errors
  }

  // Use unified speakCompleteText for consistent behavior with manual TTS
  // This automatically flushes any remaining chunks and speaks the complete text
  speakCompleteText(text);
}

/**
 * Call this when a new message stream STARTS
 * (user sends a prompt and assistant begins streaming)
 */
export function onStreamStart(messageId: string): void {
  if (!isAutoSpeakEnabled() || !isTtsSupported()) {
    return;
  }

  // Stop any previous speech
  stopTts();

  // Reset stream buffer and state
  currentStreamText = "";
  isStreamInProgress = true;
  lastAutoSpokenMessageId = messageId;

  try {
    localStorage.setItem("openclaw_tts_last_spoken", messageId);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Call when user explicitly stops/cancels the auto-speak
 */
export function onAutoSpeakStop(): void {
  stopTts();
  currentStreamText = "";
}

/**
 * Get the current auto-speak state (for UI display)
 */
export function getAutoSpeakState(): {
  enabled: boolean;
  currentMessageId: string | null;
} {
  return {
    enabled: isAutoSpeakEnabled(),
    currentMessageId: lastAutoSpokenMessageId,
  };
}
