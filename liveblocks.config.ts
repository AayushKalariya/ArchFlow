import type { LiveblocksFlow } from "@liveblocks/react-flow"
import type { CanvasNode, CanvasEdge } from "./types/canvas"

declare global {
  interface Liveblocks {
    Presence: {
      cursor: { x: number; y: number } | null;
      thinking: boolean;
    };

    Storage: {
      flow: LiveblocksFlow<CanvasNode, CanvasEdge>
    };

    UserMeta: {
      id: string;
      info: {
        name: string;
        avatar: string;
        color: string;
      };
    };

    RoomEvent: {
      type: "ai-status";
      status: "processing" | "complete" | "error";
      message: string;
    };

    ThreadMetadata: {};

    FeedMessageData:
      | { status: "processing" | "complete" | "error"; text?: string }
      | { chatMessage: true; sender: string; senderName: string; content: string; timestamp: number; role?: "user" | "assistant" };

    RoomInfo: {};
  }
}

export {};
