"use client"

import { Handle, Position, type NodeProps } from "@xyflow/react"
import type { CanvasNode } from "@/types/canvas"

const handleClass =
  "!opacity-0 group-hover:!opacity-100 !transition-opacity !bg-white !border-white !w-2.5 !h-2.5"

function BidirectionalHandle({ position, side }: { position: Position; side: string }) {
  return (
    <>
      <Handle type="source" position={position} id={`${side}-s`} className={handleClass} />
      <Handle type="target" position={position} id={`${side}-t`} className={handleClass} />
    </>
  )
}

export function CanvasNodeRenderer({ data, width, height }: NodeProps<CanvasNode>) {
  return (
    <div
      className="group relative flex items-center justify-center rounded-xl border border-border-subtle text-sm font-medium"
      style={{
        width: width ?? 160,
        height: height ?? 80,
        background: data.color,
        color: "#EDEDED",
      }}
    >
      <BidirectionalHandle position={Position.Top}    side="top"    />
      <BidirectionalHandle position={Position.Right}  side="right"  />
      <BidirectionalHandle position={Position.Bottom} side="bottom" />
      <BidirectionalHandle position={Position.Left}   side="left"   />
      <span className="px-2 text-center leading-tight select-none">{data.label}</span>
    </div>
  )
}
