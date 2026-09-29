"use client"

import { useState, useRef, useCallback, useEffect, useMemo, type KeyboardEvent } from "react"
import { X, Bot, FileText, Download, Send, Loader2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import ReactMarkdown from "react-markdown"
import {
  useFeedMessages,
  useCreateFeed,
  useCreateFeedMessage,
  useUpdateMyPresence,
  useEventListener,
  useSelf,
  useStorage,
} from "@liveblocks/react"
import { useRealtimeRun } from "@trigger.dev/react-hooks"
import { isValidAiStatusPayload, isValidChatMessagePayload, type ChatMessagePayload } from "@/types/tasks"
import type { designAgent } from "@/src/trigger/design-agent"

const AI_FEED_ID = "ai-status-feed"
const CHAT_FEED_ID = "ai-chat"

const TERMINAL_STATUSES = new Set([
  "COMPLETED", "CANCELED", "FAILED", "CRASHED",
  "INTERRUPTED", "SYSTEM_FAILURE", "EXPIRED", "TIMED_OUT",
])

const STARTER_CHIPS = [
  "Design an e-commerce backend",
  "Create a chat app architecture",
  "Build a CI/CD pipeline",
]

function EmptyArchitectState({ onChipClick }: { onChipClick: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 px-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-bg-subtle">
        <Bot className="size-6 text-accent-ai-text" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-text-primary">AI Architect</p>
        <p className="text-xs text-text-muted mt-1">Ask me to design your system architecture</p>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {STARTER_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="px-3 py-2 rounded-full bg-bg-subtle text-accent-ai-text text-xs text-left hover:opacity-80 transition-opacity cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ArchitectTabProps {
  projectId: string
  roomId: string
  canvasState: { ready: boolean; error: string | null }
  statusText: string | null
  onPublishStatus: (status: "processing" | "complete" | "error", text?: string) => Promise<void>
}

function ArchitectTab({ projectId, roomId, canvasState, statusText, onPublishStatus }: ArchitectTabProps) {
  const [runId, setRunId] = useState<string | null>(null)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const updateMyPresence = useUpdateMyPresence()
  const createFeed = useCreateFeed()
  const createFeedMessage = useCreateFeedMessage()
  const self = useSelf()
  const completionHandledRef = useRef(false)

  useEffect(() => {
    createFeed(CHAT_FEED_ID).catch(() => {})
  }, [createFeed])

  const { run, error: realtimeError } = useRealtimeRun<typeof designAgent>(runId ?? "", {
    accessToken: publicToken ?? "",
    enabled: !!runId && !!publicToken,
    skipColumns: ["payload"],
  })

  const isRunning = submitting || !!runId

  const { messages: feedMessages } = useFeedMessages(CHAT_FEED_ID)

  const architectMessages = useMemo(() => {
    if (!feedMessages) return []
    return feedMessages
      .filter((m) => isValidChatMessagePayload(m.data) && (m.data as ChatMessagePayload).role !== undefined)
      .map((m) => ({ ...(m.data as ChatMessagePayload), id: m.id }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [feedMessages])

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "72px"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [architectMessages.length, scrollToBottom])

  useEventListener(({ event }) => {
    if (event.type === "ai-status" && (event.status === "complete" || event.status === "error")) {
      onPublishStatus(event.status, event.message).catch(() => {})
      updateMyPresence({ thinking: false })
    }
  })

  useEffect(() => {
    if (!run || !TERMINAL_STATUSES.has(run.status)) return
    if (completionHandledRef.current) return
    completionHandledRef.current = true

    const isSuccess = run.status === "COMPLETED"
    const content = isSuccess
      ? run.output?.summary ?? "Ghost AI finished the request."
      : run.error?.message ?? `Run ended with status: ${run.status}`

    createFeedMessage(CHAT_FEED_ID, {
      chatMessage: true,
      sender: "ghost-ai",
      senderName: "Ghost AI",
      content,
      timestamp: Date.now(),
      role: "assistant",
    }).catch(() => {})

    if (!isSuccess) {
      onPublishStatus("error", content).catch(() => {})
      updateMyPresence({ thinking: false })
    }

    setRunId(null)
    setPublicToken(null)
  }, [run, createFeedMessage, onPublishStatus, updateMyPresence])

  useEffect(() => {
    if (!realtimeError || !runId || completionHandledRef.current) return
    completionHandledRef.current = true
    const message = `Could not follow the design run: ${realtimeError.message}`
    createFeedMessage(CHAT_FEED_ID, {
      chatMessage: true, sender: "ghost-ai", senderName: "Ghost AI",
      content: message, timestamp: Date.now(), role: "assistant",
    }).catch(() => {})
    setRunId(null)
    setPublicToken(null)
  }, [realtimeError, runId, createFeedMessage])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isRunning || !canvasState.ready) return

    setSubmitting(true)

    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "72px"

    await createFeedMessage(CHAT_FEED_ID, {
      chatMessage: true,
      sender: self?.id ?? "unknown",
      senderName: self?.info?.name ?? "You",
      content: text,
      timestamp: Date.now(),
      role: "user",
    }).catch(() => {})

    try {
      await onPublishStatus("processing", "Ghost AI is reading the current canvas…")
      updateMyPresence({ thinking: true })
      const res = await fetch("/api/ai/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, roomId, projectId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error((err as { error?: string }).error ?? `Status ${res.status}`)
      }

      const { runId: newRunId, publicToken: newToken } = await res.json() as { runId: string; publicToken: string }
      completionHandledRef.current = false
      setRunId(newRunId)
      setPublicToken(newToken)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong"
      await createFeedMessage(CHAT_FEED_ID, {
        chatMessage: true,
        sender: "ghost-ai",
        senderName: "Ghost AI",
        content: msg,
        timestamp: Date.now(),
        role: "assistant",
      }).catch(() => {})
      await onPublishStatus("error", msg).catch(() => {})
      updateMyPresence({ thinking: false })
    } finally {
      setSubmitting(false)
    }
  }, [input, isRunning, canvasState.ready, projectId, roomId, self, createFeedMessage, onPublishStatus, updateMyPresence])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const handleChipClick = useCallback(
    (text: string) => {
      setInput(text)
      adjustHeight()
      textareaRef.current?.focus()
    },
    [adjustHeight],
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {architectMessages.length === 0 ? (
          <EmptyArchitectState onChipClick={handleChipClick} />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {architectMessages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl bg-[#62C073] text-[#0d1117] text-sm font-medium">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start gap-2">
                  <div className="shrink-0 mt-1.5">
                    <Bot className="size-4 text-accent-ai-text" />
                  </div>
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl bg-bg-elevated border border-border-default text-accent-ai-text text-sm">
                    {msg.content}
                  </div>
                </div>
              ),
            )}
            {isRunning && (
              <div className="flex justify-start gap-2">
                <div className="shrink-0 mt-1.5">
                  <Loader2 className="size-4 text-accent-ai-text animate-spin" />
                </div>
                <div className="max-w-[80%] px-3 py-2 rounded-2xl bg-bg-elevated border border-border-default text-accent-ai-text text-sm">
                  Working on your canvas…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {isRunning && statusText && (
        <div className="shrink-0 px-4 py-2 border-t border-border-default/50 bg-bg-subtle flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#62C073] animate-pulse shrink-0" />
          <p className="text-xs text-accent-ai-text truncate">{statusText}</p>
        </div>
      )}

      <div className="shrink-0 p-3 border-t border-border-default">
        {!canvasState.ready && (
          <p className={`text-xs mb-2 ${canvasState.error ? "text-state-error" : "text-text-muted"}`}>
            {canvasState.error ?? "Loading the current canvas…"}
          </p>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Ghost AI…"
            rows={1}
            disabled={isRunning || !canvasState.ready}
            className="flex-1 resize-none rounded-xl border border-border-default bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-subtle transition-colors overflow-y-auto disabled:opacity-60"
            style={{ minHeight: "72px", maxHeight: "160px" }}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isRunning || !canvasState.ready}
            className="shrink-0 self-end bg-[#62C073] text-[#0d1117] hover:bg-[#62C073]/80 disabled:opacity-40"
          >
            {isRunning ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function ChatTab() {
  const createFeed = useCreateFeed()
  const createFeedMessage = useCreateFeedMessage()
  const { messages } = useFeedMessages(CHAT_FEED_ID)
  const self = useSelf()
  const [input, setInput] = useState("")
  const [sendError, setSendError] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    createFeed(CHAT_FEED_ID).catch(() => {})
  }, [createFeed])

  const validMessages = useMemo<Array<ChatMessagePayload & { id: string }>>(() => {
    if (!messages) return []
    return messages
      .filter((m) => isValidChatMessagePayload(m.data))
      .map((m) => ({ ...(m.data as ChatMessagePayload), id: m.id }))
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [messages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [validMessages.length, scrollToBottom])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text) return
    setSendError(false)

    try {
      await createFeedMessage(CHAT_FEED_ID, {
        chatMessage: true,
        sender: self?.id ?? "unknown",
        senderName: self?.info?.name ?? "Unknown",
        content: text,
        timestamp: Date.now(),
      })
      setInput("")
      if (textareaRef.current) textareaRef.current.style.height = "44px"
      setTimeout(scrollToBottom, 50)
    } catch {
      setSendError(true)
    }
  }, [input, self, createFeedMessage, scrollToBottom])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {validMessages.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 px-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-bg-subtle">
              <MessageSquare className="size-6 text-accent-ai-text" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">Room Chat</p>
              <p className="text-xs text-text-muted mt-1">Collaborate with others in this room</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {validMessages.map((msg) => {
              const isMe = msg.sender === self?.id
              return (
                <div key={msg.id} className={["flex flex-col gap-0.5", isMe ? "items-end" : "items-start"].join(" ")}>
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="text-xs text-text-muted font-medium">
                      {isMe ? "You" : msg.senderName}
                    </span>
                    <span className="text-xs text-text-faint">{formatTime(msg.timestamp)}</span>
                  </div>
                  <div
                    className={[
                      "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
                      isMe
                        ? "bg-accent-primary-dim border-2 border-accent-primary/50 text-text-primary"
                        : "bg-bg-elevated border border-border-default text-text-primary",
                    ].join(" ")}
                  >
                    {msg.content}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {sendError && (
        <div className="shrink-0 px-4 py-1.5 border-t border-state-error/30">
          <p className="text-xs text-state-error">Failed to send. Try again.</p>
        </div>
      )}

      <div className="shrink-0 p-3 border-t border-border-default">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setSendError(false)
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message the room…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border-default bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-subtle transition-colors overflow-y-auto"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim()}
            className="shrink-0 self-end bg-accent-ai text-white hover:bg-accent-ai/80 disabled:opacity-40"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SpecRecord {
  id: string
  projectId: string
  filePath: string
  createdAt: string
}

function getFilename(filePath: string): string {
  try {
    const url = new URL(filePath)
    const seg = url.pathname.split("/").filter(Boolean).pop() ?? filePath
    return seg
  } catch {
    return filePath.split("/").pop() ?? filePath
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function SpecsTab({ projectId, roomId }: { projectId: string; roomId: string }) {
  const [specs, setSpecs] = useState<SpecRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSpec, setSelectedSpec] = useState<SpecRecord | null>(null)
  const [content, setContent] = useState<string | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [genError, setGenError] = useState<string | null>(null)

  const nodesMap = useStorage((root) => root.flow.nodes)
  const edgesMap = useStorage((root) => root.flow.edges)
  const { messages: chatMessages } = useFeedMessages(CHAT_FEED_ID)

  const { run } = useRealtimeRun(runId ?? "", {
    accessToken: publicToken ?? "",
    enabled: !!runId && !!publicToken,
    skipColumns: ["payload", "output"],
  })

  const isGenerating = !!runId && !!run && !TERMINAL_STATUSES.has(run.status)

  const fetchSpecs = useCallback(() => {
    fetch(`/api/projects/${projectId}/specs`)
      .then((r) => r.json())
      .then((data) => setSpecs(Array.isArray(data) ? data : []))
      .catch(() => setSpecs([]))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => {
    setLoading(true)
    fetchSpecs()
  }, [fetchSpecs])

  useEffect(() => {
    if (!run || !TERMINAL_STATUSES.has(run.status)) return
    setRunId(null)
    setPublicToken(null)
    if (run.status === "COMPLETED") {
      setGenError(null)
      fetchSpecs()
    } else {
      setGenError(`Generation failed (${run.status})`)
    }
  }, [run?.status, fetchSpecs])

  const generateSpec = useCallback(async () => {
    setGenError(null)
    const nodes = nodesMap ? Object.values(nodesMap) : []
    const edges = edgesMap ? Object.values(edgesMap) : []
    const chatHistory = chatMessages
      ?.filter((m) => isValidChatMessagePayload(m.data))
      .map((m) => m.data as ChatMessagePayload) ?? []

    try {
      const res = await fetch("/api/ai/spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, chatHistory, nodes, edges }),
      })
      if (!res.ok) throw new Error("Failed to start spec generation")
      const { runId: newRunId } = await res.json() as { runId: string }

      const tokenRes = await fetch("/api/ai/spec/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: newRunId }),
      })
      if (!tokenRes.ok) throw new Error("Failed to get token")
      const { token } = await tokenRes.json() as { token: string }

      setRunId(newRunId)
      setPublicToken(token)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Something went wrong")
    }
  }, [roomId, nodesMap, edgesMap, chatMessages])

  const openSpec = useCallback(async (spec: SpecRecord) => {
    setSelectedSpec(spec)
    setContent(null)
    setContentLoading(true)
    try {
      const r = await fetch(`/api/projects/${projectId}/specs/${spec.id}`)
      if (!r.ok) throw new Error("fetch failed")
      setContent(await r.text())
    } catch {
      setContent("Failed to load spec content.")
    } finally {
      setContentLoading(false)
    }
  }, [projectId])

  const downloadSpec = useCallback((spec: SpecRecord, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const a = document.createElement("a")
    a.href = `/api/projects/${projectId}/specs/${spec.id}/download`
    a.download = getFilename(spec.filePath)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [projectId])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 p-3 border-b border-border-default">
        <Button
          onClick={generateSpec}
          disabled={isGenerating}
          className="w-full bg-accent-ai text-white hover:bg-accent-ai/80 disabled:opacity-60 gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate Spec"
          )}
        </Button>
        {genError && (
          <p className="text-xs text-state-error mt-2 text-center">{genError}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 text-text-muted animate-spin" />
          </div>
        ) : specs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 px-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-bg-subtle">
              <FileText className="size-6 text-accent-ai-text" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text-primary">No specs yet</p>
              <p className="text-xs text-text-muted mt-1">Generate a spec above</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-3">
            {specs.map((spec) => (
              <div
                key={spec.id}
                onClick={() => openSpec(spec)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openSpec(spec) }}
                className="w-full rounded-xl bg-bg-elevated border border-border-default p-3 flex items-center gap-3 hover:border-border-subtle transition-colors text-left cursor-pointer"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-bg-subtle shrink-0">
                  <FileText className="size-4 text-accent-ai-text" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text-primary truncate">{getFilename(spec.filePath)}</p>
                  <p className="text-xs text-text-muted mt-0.5">{formatDate(spec.createdAt)}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={(e) => downloadSpec(spec, e)}
                  className="shrink-0 text-text-muted hover:text-text-primary"
                  aria-label="Download spec"
                >
                  <Download className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedSpec} onOpenChange={(open) => { if (!open) setSelectedSpec(null) }}>
        <DialogContent
          className="max-w-2xl w-full h-[80vh] flex flex-col bg-bg-surface border-border-default rounded-3xl p-0 gap-0"
          showCloseButton={false}
          onKeyDown={(e) => { if (e.key === "Escape") setSelectedSpec(null) }}
        >
          <DialogHeader className="shrink-0 flex flex-row items-center justify-between px-5 py-4 border-b border-border-default gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileText className="size-4 text-accent-ai-text shrink-0" />
              <DialogTitle className="text-sm font-medium text-text-primary truncate">
                {selectedSpec ? getFilename(selectedSpec.filePath) : ""}
              </DialogTitle>
              {selectedSpec && (
                <span className="text-xs text-text-muted shrink-0">{formatDate(selectedSpec.createdAt)}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {selectedSpec && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadSpec(selectedSpec)}
                  className="gap-1.5 text-text-muted hover:text-text-primary"
                >
                  <Download className="size-4" />
                  Download
                </Button>
              )}
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => setSelectedSpec(null)}
                aria-label="Close"
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {contentLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-6 text-text-muted animate-spin" />
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none text-text-primary [&_h1]:text-text-primary [&_h2]:text-text-primary [&_h3]:text-text-primary [&_p]:text-text-secondary [&_li]:text-text-secondary [&_code]:text-accent-ai-text [&_code]:bg-bg-subtle [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-subtle [&_pre]:rounded-xl [&_hr]:border-border-default [&_a]:text-accent-ai-text">
                <ReactMarkdown>{content ?? ""}</ReactMarkdown>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  roomId: string
  canvasState: { ready: boolean; error: string | null }
}

export function AiSidebar({ isOpen, onClose, projectId, roomId, canvasState }: AiSidebarProps) {
  const createFeed = useCreateFeed()
  const createFeedMessage = useCreateFeedMessage()
  const { messages } = useFeedMessages(AI_FEED_ID)

  useEffect(() => {
    createFeed(AI_FEED_ID).catch(() => {})
  }, [createFeed])

  const latestMsg = messages?.[messages.length - 1]
  const validPayload = latestMsg && isValidAiStatusPayload(latestMsg.data) ? latestMsg.data : null
  const isRunning = validPayload?.status === "processing"
  const statusText = validPayload?.text ?? null

  const handlePublishStatus = useCallback(
    async (status: "processing" | "complete" | "error", text?: string) => {
      await createFeedMessage(AI_FEED_ID, { status, ...(text ? { text } : {}) })
    },
    [createFeedMessage],
  )

  return (
    <aside
      className={[
        "fixed top-12 right-0 z-50 flex flex-col",
        "h-[calc(100vh-3rem)] w-80",
        "bg-bg-surface border-l border-border-default shadow-xl",
        "transition-transform duration-200 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-default shrink-0">
        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-bg-subtle shrink-0">
          <Bot className="size-4 text-accent-ai-text" />
          {isRunning && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent-ai animate-pulse" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary leading-none">AI Workspace</p>
          <p className="text-xs text-text-muted mt-1">
            {isRunning ? "AI is working…" : "Collaborate with Spec AI"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close AI sidebar"
          className="shrink-0"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="architect" className="flex flex-col flex-1 overflow-hidden gap-0">
        <div className="shrink-0 px-3 py-2 border-b border-border-default">
          <TabsList className="w-full h-auto gap-1 rounded-xl bg-bg-subtle p-1">
            <TabsTrigger
              value="architect"
              className="flex-1 rounded-lg text-xs font-medium text-text-muted border-transparent shadow-none data-active:!bg-accent-ai data-active:!text-white data-active:!border-transparent data-active:!shadow-none"
            >
              AI Architect
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              className="flex-1 rounded-lg text-xs font-medium text-text-muted border-transparent shadow-none data-active:!bg-accent-ai data-active:!text-white data-active:!border-transparent data-active:!shadow-none"
            >
              Chat
            </TabsTrigger>
            <TabsTrigger
              value="specs"
              className="flex-1 rounded-lg text-xs font-medium text-text-muted border-transparent shadow-none data-active:!bg-accent-ai data-active:!text-white data-active:!border-transparent data-active:!shadow-none"
            >
              Specs
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="architect" className="flex flex-col flex-1 overflow-hidden m-0">
          <ArchitectTab
            projectId={projectId}
            roomId={roomId}
            canvasState={canvasState}
            statusText={statusText}
            onPublishStatus={handlePublishStatus}
          />
        </TabsContent>

        <TabsContent value="chat" className="flex flex-col flex-1 overflow-hidden m-0">
          <ChatTab />
        </TabsContent>

        <TabsContent value="specs" className="flex flex-col flex-1 overflow-hidden m-0">
          <SpecsTab projectId={projectId} roomId={roomId} />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
