"use client"

import { useState, useCallback } from "react"
import { EditorNavbar } from "@/components/editor/editor-navbar"
import { ProjectSidebar } from "@/components/editor/project-sidebar"
import { ProjectDialogs } from "@/components/editor/project-dialogs"
import { ShareDialog } from "@/components/editor/share-dialog"
import { CanvasWrapper } from "@/components/editor/canvas-wrapper"
import { StarterTemplatesModal } from "@/components/editor/starter-templates-modal"
import { AiSidebar } from "@/components/editor/ai-sidebar"
import { useProjectActions } from "@/hooks/use-project-actions"
import type { Project } from "@/lib/projects"
import type { CanvasTemplate, PendingTemplate } from "@/components/editor/starter-templates"

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
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] = useState<PendingTemplate | null>(null)
  const actions = useProjectActions(project.id)

  const handleImportTemplate = useCallback((template: CanvasTemplate) => {
    setPendingTemplate({ nodes: template.nodes, edges: template.edges, stamp: Date.now() })
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg-base">
      <EditorNavbar
        sidebarOpen={sidebarOpen}
        onSidebarToggle={() => setSidebarOpen((v) => !v)}
        projectName={project.name}
        aiSidebarOpen={aiSidebarOpen}
        onAiToggle={() => setAiSidebarOpen((v) => !v)}
        onShare={() => setShareOpen(true)}
        onTemplates={() => setTemplatesOpen(true)}
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
        <main className="flex-1 relative overflow-hidden bg-bg-base">
          <CanvasWrapper
            roomId={project.id}
            projectId={project.id}
            pendingTemplate={pendingTemplate}
            onTemplateDone={() => setPendingTemplate(null)}
          />
        </main>
      </div>

      <AiSidebar isOpen={aiSidebarOpen} onClose={() => setAiSidebarOpen(false)} />

      <ProjectDialogs {...actions} />
      <StarterTemplatesModal
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        onImport={handleImportTemplate}
      />
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        projectId={project.id}
        isOwner={isOwner}
      />
    </div>
  )
}
