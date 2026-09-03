"use client"

import { useState, useEffect, useRef, type DragEvent } from "react"
import { Square, Diamond, Circle, Pill, Database, Hexagon } from "lucide-react"
import type { NodeShape } from "@/types/canvas"
import { NODE_COLORS } from "@/types/canvas"
import { NodeShapeBody } from "./canvas-node"

const DEFAULT_FILL = NODE_COLORS[0].fill

export interface ShapeDragPayload {
  shape: NodeShape
  width: number
  height: number
}

interface ShapeConfig {
  shape: NodeShape
  icon: React.ElementType
  label: string
  width: number
  height: number
}

const SHAPE_CONFIGS: ShapeConfig[] = [
  { shape: "rectangle", icon: Square,   label: "Rectangle", width: 160, height: 80  },
  { shape: "diamond",   icon: Diamond,  label: "Diamond",   width: 140, height: 140 },
  { shape: "circle",    icon: Circle,   label: "Circle",    width: 100, height: 100 },
  { shape: "pill",      icon: Pill,     label: "Pill",      width: 160, height: 60  },
  { shape: "cylinder",  icon: Database, label: "Cylinder",  width: 100, height: 80  },
  { shape: "hexagon",   icon: Hexagon,  label: "Hexagon",   width: 120, height: 120 },
]

export function ShapePanel() {
  const [dragging, setDragging] = useState<ShapeConfig | null>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const draggingRef = useRef<ShapeConfig | null>(null)

  useEffect(() => {
    function onDragOver(e: globalThis.DragEvent) {
      if (draggingRef.current) setPos({ x: e.clientX, y: e.clientY })
    }
    function onDragEnd() {
      draggingRef.current = null
      setDragging(null)
    }
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("dragend", onDragEnd)
    return () => {
      document.removeEventListener("dragover", onDragOver)
      document.removeEventListener("dragend", onDragEnd)
    }
  }, [])

  function handleDragStart(e: DragEvent<HTMLButtonElement>, config: ShapeConfig) {
    const payload: ShapeDragPayload = { shape: config.shape, width: config.width, height: config.height }
    e.dataTransfer.setData("application/ghost-shape", JSON.stringify(payload))
    e.dataTransfer.effectAllowed = "copy"

    // Suppress native browser drag ghost
    const phantom = document.createElement("div")
    phantom.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0"
    document.body.appendChild(phantom)
    e.dataTransfer.setDragImage(phantom, 0, 0)
    requestAnimationFrame(() => phantom.remove())

    draggingRef.current = config
    setDragging(config)
    setPos({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <div className="flex items-center gap-1 px-3 py-2 rounded-full bg-bg-elevated border border-border-default shadow-lg">
        {SHAPE_CONFIGS.map((config) => {
          const Icon = config.icon
          return (
            <button
              key={config.shape}
              draggable
              onDragStart={(e) => handleDragStart(e, config)}
              title={config.label}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-text-secondary hover:text-text-primary hover:bg-bg-subtle transition-colors cursor-grab active:cursor-grabbing"
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>

      {dragging && (
        <div
          className="fixed pointer-events-none z-50 opacity-75"
          style={{
            left: pos.x - dragging.width / 2,
            top: pos.y - dragging.height / 2,
            width: dragging.width,
            height: dragging.height,
          }}
        >
          <NodeShapeBody
            shape={dragging.shape}
            w={dragging.width}
            h={dragging.height}
            fill={DEFAULT_FILL}
          />
        </div>
      )}
    </>
  )
}
