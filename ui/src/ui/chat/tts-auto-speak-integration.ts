/**
 * Auto-speak integration helper for chat messages.
 * Hooks into message lifecycle events to trigger auto-speaking.
 */

import { onAssistantMessageComplete, onStreamStart, initAutoSpeakListener } from "./tts-auto-speak.js";

/**
 * Initialize auto-speak listener on chat mount.
 * Call this once when the chat component initializes.
 */
export function initializeAutoSpeak(): void {
  if (typeof globalThis !== "undefined") {
    initAutoSpeakListener();
  }
}

/**
 * Notify auto-speak that a message stream has started.
 * Call this when the user sends a message and the assistant starts replying.
 */
export function notifyStreamStart(messageId: string): void {
  onStreamStart(messageId);
}

/**
 * Notify auto-speak that an assistant message is complete.
 * Call this when the final message is fully rendered (after stream ends).
 */
export function notifyMessageComplete(messageId: string, message: unknown): void {
  onAssistantMessageComplete(messageId, message);
}

/**
 * Build a unique message ID for tracking.
 * Use timestamp + role to create stable IDs.
 */
export function buildMessageId(timestamp: number, role: string, index: number): string {
  return `${role}:${timestamp}:${index}`;
}
