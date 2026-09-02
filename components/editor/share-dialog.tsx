"use client"

import { useState, useEffect, useCallback } from "react"
import { Copy, Check, X, UserPlus, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

interface Collaborator {
  id: string
  email: string
  displayName: string | null
  imageUrl: string | null
}

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  isOwner: boolean
}

export function ShareDialog({
  open,
  onOpenChange,
  projectId,
  isOwner,
}: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [inviting, setInviting] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCollaborators = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`)
      if (res.ok) setCollaborators(await res.json())
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      fetchCollaborators()
    }
  }, [open, fetchCollaborators])

  async function handleInvite() {
    const trimmed = email.trim()
    if (!trimmed) return
    setInviting(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/collaborators`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      if (res.status === 409) {
        setError("Already a collaborator.")
        return
      }
      if (!res.ok) {
        setError("Failed to invite. Try again.")
        return
      }
      setEmail("")
      await fetchCollaborators()
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(collaboratorId: string) {
    setRemovingId(collaboratorId)
    try {
      await fetch(
        `/api/projects/${projectId}/collaborators/${collaboratorId}`,
        { method: "DELETE" }
      )
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId))
    } finally {
      setRemovingId(null)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (isOpen) setError(null); onOpenChange(isOpen); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Invite people by email to collaborate."
              : "People with access to this project."}
          </DialogDescription>
        </DialogHeader>

        {isOwner && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2">
              <Input
                placeholder="Email address"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && email.trim()) handleInvite()
                }}
              />
              <Button
                onClick={handleInvite}
                disabled={inviting || !email.trim()}
                className="shrink-0 gap-1.5"
              >
                {inviting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <UserPlus className="size-3.5" />
                )}
                Invite
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        )}

        <div className="flex flex-col gap-0.5 max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-4 animate-spin text-text-muted" />
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">
              No collaborators yet.
            </p>
          ) : (
            collaborators.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-bg-elevated"
              >
                <Avatar size="sm">
                  {c.imageUrl && (
                    <AvatarImage
                      src={c.imageUrl}
                      alt={c.displayName ?? c.email}
                    />
                  )}
                  <AvatarFallback>
                    {(c.displayName ?? c.email).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col flex-1 min-w-0">
                  {c.displayName && (
                    <span className="text-sm text-text-primary truncate">
                      {c.displayName}
                    </span>
                  )}
                  <span className="text-xs text-text-muted truncate">
                    {c.email}
                  </span>
                </div>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleRemove(c.id)}
                    disabled={removingId === c.id}
                    aria-label="Remove collaborator"
                  >
                    {removingId === c.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border-default pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            {copied ? (
              <Check className="size-3.5 text-accent-primary" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
