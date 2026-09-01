"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { Project } from "@/lib/projects"

export type DialogType = "create" | "rename" | "delete" | null

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "project"
  )
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7)
}

export function useProjectActions(activeProjectId?: string) {
  const router = useRouter()
  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [targetProject, setTargetProject] = useState<Project | null>(null)
  const [name, setName] = useState("")
  const [suffix, setSuffix] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const roomIdPreview = name.trim() ? `${slugify(name.trim())}-${suffix}` : ""

  function openCreate() {
    setName("")
    setSuffix(randomSuffix())
    setIsLoading(false)
    setDialogType("create")
  }

  function openRename(project: Project) {
    setName(project.name)
    setTargetProject(project)
    setIsLoading(false)
    setDialogType("rename")
  }

  function openDelete(project: Project) {
    setTargetProject(project)
    setIsLoading(false)
    setDialogType("delete")
  }

  function close() {
    setDialogType(null)
    setTargetProject(null)
    setName("")
    setSuffix("")
    setIsLoading(false)
  }

  async function handleCreate() {
    if (!name.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error("Failed to create project")
      const project: { id: string } = await res.json()
      close()
      router.refresh()
      router.push(`/editor/${project.id}`)
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  async function handleRename() {
    if (!targetProject || !name.trim()) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${targetProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) throw new Error("Failed to rename project")
      close()
      router.refresh()
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  async function handleDelete() {
    if (!targetProject) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${targetProject.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete project")
      const wasActive = activeProjectId === targetProject.id
      close()
      if (wasActive) {
        router.push("/editor")
      } else {
        router.refresh()
      }
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  return {
    dialogType,
    targetProject,
    name,
    setName,
    isLoading,
    roomIdPreview,
    openCreate,
    openRename,
    openDelete,
    close,
    handleCreate,
    handleRename,
    handleDelete,
  }
}

export type UseProjectActionsReturn = ReturnType<typeof useProjectActions>
