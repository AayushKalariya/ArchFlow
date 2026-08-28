"use client"

import { useState } from "react"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"

export default function Home() {
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
      <main className="flex flex-1 items-center justify-center mt-12 text-text-muted text-sm">
        Canvas workspace
      </main>
    </div>
  )
}
