"use client"

import { Minus, Plus, Maximize2, Undo2, Redo2 } from "lucide-react"
import { useReactFlow } from "@xyflow/react"
import { useUndo, useRedo, useCanUndo, useCanRedo } from "@liveblocks/react"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"

const ZOOM_DURATION = 300

export function CanvasControls() {
  const rf = useReactFlow()
  const undo = useUndo()
  const redo = useRedo()
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()

  useKeyboardShortcuts(rf, undo, redo)

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 rounded-full bg-bg-elevated border border-border-default shadow-lg">
      <button
        onClick={() => rf.zoomOut({ duration: ZOOM_DURATION })}
        title="Zoom out (-)"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => rf.fitView({ duration: ZOOM_DURATION })}
        title="Fit view"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => rf.zoomIn({ duration: ZOOM_DURATION })}
        title="Zoom in (+)"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      <div className="w-px h-4 bg-border-default mx-1" />

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary"
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className="flex items-center justify-center w-7 h-7 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary"
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
