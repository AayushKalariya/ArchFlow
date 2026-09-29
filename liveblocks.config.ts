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
      appliedAiRuns?: import("@liveblocks/client").LiveMap<string, string>
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
      fitView?: boolean;
    };

    ThreadMetadata: {};

    FeedMessageData:
      | { status: "processing" | "complete" | "error"; text?: string }
      | { chatMessage: true; sender: string; senderName: string; content: string; timestamp: number; role?: "user" | "assistant" };

    RoomInfo: {};
  }
}

export {};
