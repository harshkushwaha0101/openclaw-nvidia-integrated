import { html, nothing } from "lit";
import { icons } from "../icons.ts";
import { isTtsSupported, isAutoSpeakEnabled, setAutoSpeak } from "./speech.ts";

export type ChatRunControlsProps = {
  canAbort: boolean;
  connected: boolean;
  draft: string;
  hasMessages: boolean;
  isBusy: boolean;
  sending: boolean;
  onAbort?: () => void;
  onExport: () => void;
  onNewSession: () => void;
  onSend: () => void;
  onStoreDraft: (draft: string) => void;
};

export function renderChatRunControls(props: ChatRunControlsProps) {
  const autoSpeakOn = isAutoSpeakEnabled();

  return html`
    <div class="agent-chat__toolbar-right">
      ${props.canAbort
        ? nothing
        : html`
            <button
              class="btn btn--ghost"
              @click=${props.onNewSession}
              title="New session"
              aria-label="New session"
            >
              ${icons.plus}
            </button>
          `}
      ${isTtsSupported()
        ? html`
            <button
              class="btn btn--ghost chat-tts-toggle ${autoSpeakOn
                ? "chat-tts-toggle--active"
                : ""}"
              @click=${() => {
                setAutoSpeak(!autoSpeakOn);
                // Trigger re-render to update button state
                requestAnimationFrame(() => {
                  // Component will re-render and pick up new autoSpeakOn state
                  document.dispatchEvent(new CustomEvent("tts-toggle"));
                });
              }}
              title=${autoSpeakOn ? "Auto-speak: ON" : "Auto-speak: OFF"}
              aria-label=${autoSpeakOn ? "Disable auto-speak" : "Enable auto-speak"}
            >
              ${autoSpeakOn ? icons.volume2 : icons.volumeOff}
            </button>
          `
        : nothing}
      <button
        class="btn btn--ghost"
        @click=${props.onExport}
        title="Export"
        aria-label="Export chat"
        ?disabled=${!props.hasMessages}
      >
        ${icons.download}
      </button>

      ${props.canAbort
        ? html`
            <button
              class="chat-send-btn chat-send-btn--stop"
              @click=${props.onAbort}
              title="Stop"
              aria-label="Stop generating"
            >
              ${icons.stop}
            </button>
          `
        : html`
            <button
              class="chat-send-btn"
              @click=${() => {
                if (props.draft.trim()) {
                  props.onStoreDraft(props.draft);
                }
                props.onSend();
              }}
              ?disabled=${!props.connected || props.sending}
              title=${props.isBusy ? "Queue" : "Send"}
              aria-label=${props.isBusy ? "Queue message" : "Send message"}
            >
              ${icons.send}
            </button>
          `}
    </div>
  `;
}
