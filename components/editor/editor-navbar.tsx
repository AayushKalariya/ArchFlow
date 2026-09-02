"use client"

import { PanelLeftOpen, PanelLeftClose, Share2, BotMessageSquare } from "lucide-react"
import { UserButton } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"

interface EditorNavbarProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
  projectName?: string
  aiSidebarOpen?: boolean
  onAiToggle?: () => void
  onShare?: () => void
}

export function EditorNavbar({
  sidebarOpen,
  onSidebarToggle,
  projectName,
  aiSidebarOpen,
  onAiToggle,
  onShare,
}: EditorNavbarProps) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 h-12 flex items-center px-3 bg-bg-surface border-b border-border-default">
      <div className="flex items-center gap-2 flex-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSidebarToggle}
          aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="size-4" />
          ) : (
            <PanelLeftOpen className="size-4" />
          )}
        </Button>
      </div>

      <div className="flex items-center justify-center flex-1">
        {projectName && (
          <span className="text-sm font-medium text-text-primary truncate max-w-xs">
            {projectName}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 flex-1">
        {onShare && (
          <Button variant="outline" size="sm" onClick={onShare} className="gap-1.5">
            <Share2 className="size-3.5" />
            Share
          </Button>
        )}
        {onAiToggle && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onAiToggle}
            aria-label={aiSidebarOpen ? "Close AI sidebar" : "Open AI sidebar"}
            data-active={aiSidebarOpen}
            className="data-[active=true]:text-accent-ai-text"
          >
            <BotMessageSquare className="size-4" />
          </Button>
        )}
        <UserButton />
      </div>
    </header>
  )
}
