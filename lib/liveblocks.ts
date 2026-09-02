import { Liveblocks } from "@liveblocks/node";

const CURSOR_COLORS = [
  "#E57373",
  "#F06292",
  "#BA68C8",
  "#64B5F6",
  "#4DD0E1",
  "#81C784",
  "#FFD54F",
  "#FF8A65",
  "#A1887F",
  "#90A4AE",
];

export function getCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

const globalForLiveblocks = globalThis as unknown as {
  liveblocks: Liveblocks | undefined;
};

export function getLiveblocks(): Liveblocks {
  if (!globalForLiveblocks.liveblocks) {
    globalForLiveblocks.liveblocks = new Liveblocks({
      secret: process.env.LIVEBLOCKS_SECRET_KEY!,
    });
  }
  return globalForLiveblocks.liveblocks;
}
