"use client"

import type { DragEvent } from "react"
import { Square, Diamond, Circle, Pill, Database, Hexagon } from "lucide-react"
import type { NodeShape } from "@/types/canvas"

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
  function handleDragStart(e: DragEvent<HTMLButtonElement>, config: ShapeConfig) {
    const payload: ShapeDragPayload = {
      shape: config.shape,
      width: config.width,
      height: config.height,
    }
    e.dataTransfer.setData("application/ghost-shape", JSON.stringify(payload))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
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
  )
}
