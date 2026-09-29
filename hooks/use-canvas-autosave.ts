"use client"

import { useEffect, useRef, useState } from "react"
import type { CanvasNode, CanvasEdge } from "@/types/canvas"

export type SaveStatus = "idle" | "saving" | "saved" | "error"

export function useCanvasAutosave(
  projectId: string,
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  enabled: boolean,
): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const saveSequence = useRef(0)

  useEffect(() => {
    if (!enabled) return
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    const sequence = ++saveSequence.current

    timerRef.current = setTimeout(async () => {
      setStatus("saving")
      try {
        let res: Response | null = null
        for (let attempt = 0; attempt < 3; attempt++) {
          res = await fetch(`/api/projects/${projectId}/canvas`, { method: "PUT" })
          if (res.status !== 409) break
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
        }
        if (!res?.ok) throw new Error("save failed")
        if (sequence === saveSequence.current) setStatus("saved")
      } catch {
        if (sequence === saveSequence.current) setStatus("error")
      }
    }, 2000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // nodes/edges arrays from Liveblocks change reference only when data changes
  }, [projectId, nodes, edges, enabled])

  return status
}
