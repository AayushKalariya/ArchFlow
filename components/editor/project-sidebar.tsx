"use client"

import { X, Plus, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface ProjectSidebarProps {
  isOpen: boolean
  onClose: () => void
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-text-muted">
      <FolderOpen className="size-8 opacity-40" />
      <p className="text-sm">No {label} yet</p>
    </div>
  )
}

export function ProjectSidebar({ isOpen, onClose }: ProjectSidebarProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
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
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close sidebar">
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden p-3 gap-3">
          <Tabs defaultValue="mine" className="flex-1 overflow-hidden">
            <TabsList className="w-full">
              <TabsTrigger value="mine" className="flex-1">My Projects</TabsTrigger>
              <TabsTrigger value="shared" className="flex-1">Shared</TabsTrigger>
            </TabsList>

            <TabsContent value="mine" className="mt-3 overflow-y-auto">
              <EmptyState label="projects" />
            </TabsContent>

            <TabsContent value="shared" className="mt-3 overflow-y-auto">
              <EmptyState label="shared projects" />
            </TabsContent>
          </Tabs>
        </div>

        <div className="p-3 border-t border-border-default shrink-0">
          <Button className="w-full gap-2" size="sm">
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </aside>
    </>
  )
}
