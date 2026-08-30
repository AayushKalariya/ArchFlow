"use client"

import { useState } from "react"
import type { MockProject } from "@/lib/mock-projects"

export type DialogType = "create" | "rename" | "delete" | null

export function useProjectDialogs() {
  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [targetProject, setTargetProject] = useState<MockProject | null>(null)
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  function openCreate() {
    setName("")
    setDialogType("create")
  }

  function openRename(project: MockProject) {
    setName(project.name)
    setTargetProject(project)
    setDialogType("rename")
  }

  function openDelete(project: MockProject) {
    setTargetProject(project)
    setDialogType("delete")
  }

  function close() {
    setDialogType(null)
    setTargetProject(null)
    setName("")
  }

  function simulate(cb: () => void) {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      cb()
    }, 500)
  }

  function handleCreate() {
    simulate(close)
  }

  function handleRename() {
    simulate(close)
  }

  function handleDelete() {
    simulate(close)
  }

  return {
    dialogType,
    targetProject,
    name,
    setName,
    isLoading,
    openCreate,
    openRename,
    openDelete,
    close,
    handleCreate,
    handleRename,
    handleDelete,
  }
}

export type UseProjectDialogsReturn = ReturnType<typeof useProjectDialogs>
