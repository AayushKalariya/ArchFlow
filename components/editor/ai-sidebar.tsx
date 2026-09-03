"use client"

import { useState, useRef, useCallback, type KeyboardEvent } from "react"
import { X, Bot, FileText, Download, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

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

function ArchitectTab() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "72px"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user" as const, content: text },
    ])
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "72px"
  }, [input])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    },
    [sendMessage],
  )

  const handleChipClick = useCallback((text: string) => {
    setInput(text)
    adjustHeight()
    textareaRef.current?.focus()
  }, [adjustHeight])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyArchitectState onChipClick={handleChipClick} />
        ) : (
          <div className="flex flex-col gap-3 p-4">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl bg-accent-primary-dim border-2 border-accent-primary/50 text-text-primary text-sm">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex justify-start">
                  <div className="max-w-[80%] px-3 py-2 rounded-2xl bg-bg-elevated border border-border-default text-accent-ai-text text-sm">
                    {msg.content}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 p-3 border-t border-border-default">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); adjustHeight() }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Ghost AI…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border-default bg-bg-elevated px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-border-subtle transition-colors overflow-y-auto"
            style={{ minHeight: "72px", maxHeight: "160px" }}
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

function SpecsTab() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Button className="w-full bg-accent-ai text-white hover:bg-accent-ai/80">
        Generate Spec
      </Button>

      <div className="rounded-2xl bg-bg-elevated border border-border-default p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-bg-subtle shrink-0">
            <FileText className="size-4 text-accent-ai-text" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">System Architecture Spec</p>
            <p className="text-xs text-text-muted mt-0.5 line-clamp-2">
              Microservices overview with API gateway, auth service, and data layer breakdown.
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" disabled className="gap-1.5 text-text-faint opacity-50">
            <Download className="size-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}

interface AiSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function AiSidebar({ isOpen, onClose }: AiSidebarProps) {
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
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-bg-subtle shrink-0">
          <Bot className="size-4 text-accent-ai-text" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary leading-none">AI Workspace</p>
          <p className="text-xs text-text-muted mt-1">Collaborate with Ghost AI</p>
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
        <TabsList className="w-full shrink-0 rounded-none h-auto py-2 px-3 border-b border-border-default bg-transparent">
          <TabsTrigger
            value="architect"
            className="flex-1 text-text-muted data-active:!bg-accent-ai data-active:!text-white data-active:!border-transparent data-active:!shadow-none"
          >
            AI Architect
          </TabsTrigger>
          <TabsTrigger
            value="specs"
            className="flex-1 text-text-muted data-active:!bg-accent-ai data-active:!text-white data-active:!border-transparent data-active:!shadow-none"
          >
            Specs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="architect" className="flex flex-col flex-1 overflow-hidden m-0">
          <ArchitectTab />
        </TabsContent>

        <TabsContent value="specs" className="flex-1 overflow-y-auto m-0">
          <SpecsTab />
        </TabsContent>
      </Tabs>
    </aside>
  )
}
