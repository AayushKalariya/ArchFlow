"use client"

import { useState } from "react"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"

export function EditorShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex flex-col h-full">
      <EditorNavbar
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((v) => !v)}
      />
      <ProjectSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex flex-1 mt-12 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
