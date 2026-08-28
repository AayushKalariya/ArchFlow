"use client"

import { PanelLeftOpen, PanelLeftClose } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EditorNavbarProps {
  sidebarOpen: boolean
  onSidebarToggle: () => void
}

export function EditorNavbar({ sidebarOpen, onSidebarToggle }: EditorNavbarProps) {
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

      <div className="flex items-center justify-center flex-1" />

      <div className="flex items-center justify-end flex-1" />
    </header>
  )
}
