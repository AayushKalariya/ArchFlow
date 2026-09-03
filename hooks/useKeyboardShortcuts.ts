"use client"

import { useEffect } from "react"
import type { ReactFlowInstance } from "@xyflow/react"

const ZOOM_DURATION = 300

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.isContentEditable
  )
}

export function useKeyboardShortcuts(
  rf: ReactFlowInstance | null,
  undo: () => void,
  redo: () => void,
) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return

      const mod = e.ctrlKey || e.metaKey

      if (!mod) {
        if (e.key === "+" || e.key === "=") {
          e.preventDefault()
          rf?.zoomIn({ duration: ZOOM_DURATION })
          return
        }
        if (e.key === "-") {
          e.preventDefault()
          rf?.zoomOut({ duration: ZOOM_DURATION })
          return
        }
      }

      if (mod && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }

      if (mod && (e.key === "z" && e.shiftKey)) {
        e.preventDefault()
        redo()
        return
      }

      if (mod && e.key === "y") {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [rf, undo, redo])
}
