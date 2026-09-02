"use client"

import { useState } from "react"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ProjectDialogs } from "@/components/editor/project-dialogs"
import { ShareDialog } from "@/components/editor/share-dialog"
import { useProjectActions } from "@/hooks/use-project-actions"
import type { Project } from "@/lib/projects"

interface WorkspaceShellProps {
  project: { id: string; name: string }
  isOwner: boolean
  ownedProjects: Project[]
  sharedProjects: Project[]
}

export function WorkspaceShell({ project, isOwner, ownedProjects, sharedProjects }: WorkspaceShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const actions = useProjectActions(project.id)

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base">
      <EditorNavbar
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((v) => !v)}
        projectName={project.name}
        aiSidebarOpen={aiSidebarOpen}
        onAiToggle={() => setAiSidebarOpen((v) => !v)}
        onShare={() => setShareOpen(true)}
      />

      <ProjectSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ownedProjects={ownedProjects}
        sharedProjects={sharedProjects}
        onCreateProject={actions.openCreate}
        onRenameProject={actions.openRename}
        onDeleteProject={actions.openDelete}
        activeProjectId={project.id}
      />

      <div className="flex flex-1 mt-12 overflow-hidden">
        <main className="flex flex-1 items-center justify-center bg-bg-base">
          <span className="text-sm text-text-muted">Canvas coming soon</span>
        </main>

        {aiSidebarOpen && (
          <aside className="w-80 shrink-0 border-l border-border-default bg-bg-surface flex flex-col">
            <div className="flex items-center px-4 h-12 border-b border-border-default shrink-0">
              <span className="text-sm font-medium text-text-primary">AI Assistant</span>
            </div>
            <div className="flex flex-1 items-center justify-center p-4">
              <span className="text-sm text-text-muted text-center">AI chat coming soon</span>
            </div>
          </aside>
        )}
      </div>

      <ProjectDialogs {...actions} />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={project.id}
        isOwner={isOwner}
      />
    </div>
  )
}
