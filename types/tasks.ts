export interface AiStatusPayload {
  status: "processing" | "complete" | "error"
  text?: string
}

export function isValidAiStatusPayload(value: unknown): value is AiStatusPayload {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  if (!["processing", "complete", "error"].includes(v.status as string)) return false
  if ("text" in v && v.text !== undefined && typeof v.text !== "string") return false
  return true
}

export interface ChatMessagePayload {
  chatMessage: true
  sender: string
  senderName: string
  content: string
  timestamp: number
  role?: "user" | "assistant"
}

export function isValidChatMessagePayload(value: unknown): value is ChatMessagePayload {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  if (v.chatMessage !== true) return false
  if (typeof v.sender !== "string" || !v.sender) return false
  if (typeof v.senderName !== "string" || !v.senderName) return false
  if (typeof v.content !== "string" || !v.content) return false
  if (typeof v.timestamp !== "number") return false
  return true
}
