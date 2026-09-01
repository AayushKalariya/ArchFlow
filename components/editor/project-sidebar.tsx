"use client"

import { X, Plus, FolderOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { Project } from "@/lib/projects"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
  ownedProjects: Project[]
  sharedProjects: Project[]
  onCreateProject: () => void
  onRenameProject: (project: Project) => void
  onDeleteProject: (project: Project) => void
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
      <FolderOpen className="size-8 opacity-40" />
      <p className="text-sm">No {label} yet</p>
    </div>
  )
}

function ProjectItem({
  project,
  onRename,
  onDelete,
}: {
  project: Project
  onRename: (p: Project) => void
  onDelete: (p: Project) => void
}) {
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-muted/50 cursor-pointer">
      <span className="flex-1 truncate">{project.name}</span>
      {project.isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                onClick={(e) => e.stopPropagation()}
              />
            }
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Project actions</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start">
            <DropdownMenuItem onClick={() => onRename(project)}>
              <Pencil className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

export function ProjectSidebar({
  isOpen,
  onClose,
  ownedProjects,
  sharedProjects,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
}: ProjectSidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:bg-transparent"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "fixed top-0 left-0 z-50 h-full w-72 flex flex-col",
          "bg-bg-surface border-r border-border-default",
          "transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-border-default shrink-0">
          <span className="text-sm font-medium text-text-primary">Projects</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
          <Tabs defaultValue="mine" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="mine" className="flex-1">My Projects</TabsTrigger>
              <TabsTrigger value="shared" className="flex-1">Shared</TabsTrigger>
            </TabsList>

            <TabsContent value="mine" className="mt-3 flex-1 overflow-y-auto">
              {ownedProjects.length === 0 ? (
                <EmptyState label="projects" />
              ) : (
                <div className="flex flex-col gap-0.5">
                  {ownedProjects.map((p) => (
                    <ProjectItem
                      key={p.id}
                      project={p}
                      onRename={onRenameProject}
                      onDelete={onDeleteProject}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="shared" className="mt-3 flex-1 overflow-y-auto">
              {sharedProjects.length === 0 ? (
                <EmptyState label="shared projects" />
              ) : (
                <div className="flex flex-col gap-0.5">
                  {sharedProjects.map((p) => (
                    <ProjectItem
                      key={p.id}
                      project={p}
                      onRename={onRenameProject}
                      onDelete={onDeleteProject}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-3 border-t border-border-default shrink-0">
          <Button className="w-full gap-2" size="sm" onClick={onCreateProject}>
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </aside>
    </>
  )
}
