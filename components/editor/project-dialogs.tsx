"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UseProjectActionsReturn } from "@/hooks/use-project-actions"

export function ProjectDialogs({
  dialogType,
  targetProject,
  name,
  setName,
  isLoading,
  roomIdPreview,
  close,
  handleCreate,
  handleRename,
  handleDelete,
}: UseProjectActionsReturn) {
  const handleDialogOpenChange = (open: boolean) => {
    if (!open && isLoading) return
    if (!open) close()
  }

  return (
    <>
      <Dialog
        open={dialogType === "create"}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>
              Give your project a name to get started.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="create-name">Project name</Label>
              <Input
                id="create-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) handleCreate()
                }}
                placeholder="My Project"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Room ID:{" "}
              <span className="font-mono text-foreground/70">
                {roomIdPreview || "…"}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogType === "rename"}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Rename Project</DialogTitle>
            <DialogDescription>
              Renaming &ldquo;{targetProject?.name}&rdquo;
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-name">Project name</Label>
            <Input
              id="rename-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleRename()
              }}
              placeholder="Project name"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={isLoading || !name.trim()}
            >
              {isLoading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialogType === "delete"}
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Permanently delete &ldquo;{targetProject?.name}&rdquo;? This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? "Deleting…" : "Delete Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
