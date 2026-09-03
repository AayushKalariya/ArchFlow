"use client"

import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react"
import { useMutation } from "@liveblocks/react"
import { useState, useRef, useEffect, useCallback } from "react"
import type { CanvasNode, CanvasNodeData, NodeShape } from "@/types/canvas"
import { NODE_COLORS } from "@/types/canvas"

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

export interface NodeShapeBodyProps {
  shape: NodeShape
  w: number
  h: number
  fill: string
  selected?: boolean
}

export function NodeShapeBody({ shape, w, h, fill, selected = false }: NodeShapeBodyProps) {
  const stroke = selected ? "var(--accent-primary)" : "var(--border-subtle)"
  const sw = selected ? 2 : 1

  if (shape === "rectangle") {
    return (
      <div
        className="absolute inset-0 rounded-xl"
        style={{ background: fill, border: `${sw}px solid ${stroke}` }}
      />
    )
  }

  if (shape === "pill") {
    return (
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: fill, border: `${sw}px solid ${stroke}` }}
      />
    )
  }

  if (shape === "circle") {
    return (
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: fill, border: `${sw}px solid ${stroke}` }}
      />
    )
  }

  if (shape === "diamond") {
    const half = sw / 2
    const pts = `${w / 2},${half} ${w - half},${h / 2} ${w / 2},${h - half} ${half},${h / 2}`
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0">
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    )
  }

  if (shape === "hexagon") {
    const half = sw / 2
    const pts = [
      `${w * 0.25},${half}`,
      `${w * 0.75},${half}`,
      `${w - half},${h * 0.5}`,
      `${w * 0.75},${h - half}`,
      `${w * 0.25},${h - half}`,
      `${half},${h * 0.5}`,
    ].join(" ")
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0">
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    )
  }

  if (shape === "cylinder") {
    const ry = Math.min(h * 0.2, 16)
    const rx = w / 2 - sw / 2
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0">
        {/* Body fill */}
        <rect x={sw / 2} y={ry} width={w - sw} height={h - ry * 2} fill={fill} />
        {/* Bottom cap fill (no stroke — avoids interior ellipse line) */}
        <ellipse cx={w / 2} cy={h - ry} rx={rx} ry={ry} fill={fill} />
        {/* Bottom rim arc (only the lower semicircle) */}
        <path
          d={`M ${sw / 2},${h - ry} A ${rx},${ry} 0 0 1 ${w - sw / 2},${h - ry}`}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
        {/* Side borders */}
        <line x1={sw / 2} y1={ry} x2={sw / 2} y2={h - ry} stroke={stroke} strokeWidth={sw} />
        <line x1={w - sw / 2} y1={ry} x2={w - sw / 2} y2={h - ry} stroke={stroke} strokeWidth={sw} />
        {/* Top cap (full ellipse, drawn last to cover body-cap seam) */}
        <ellipse cx={w / 2} cy={ry} rx={rx} ry={ry} fill={fill} stroke={stroke} strokeWidth={sw} />
      </svg>
    )
  }

  return (
    <div
      className="absolute inset-0 rounded-xl"
      style={{ background: fill, border: `${sw}px solid ${stroke}` }}
    />
  )
}

function ColorToolbar({
  currentFill,
  onSelect,
}: {
  currentFill: string
  onSelect: (fill: string, text: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <div
      className="absolute flex items-center gap-1 px-2 py-1.5 rounded-full bg-bg-elevated border border-border-default shadow-lg"
      style={{ bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", zIndex: 10 }}
      onMouseDown={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      {NODE_COLORS.map(({ fill, text, label }) => {
        const isActive = fill === currentFill
        const isHovered = hovered === fill
        return (
          <button
            key={fill}
            title={label}
            style={{
              background: fill,
              border: isActive ? `2px solid ${text}` : "2px solid transparent",
              boxShadow: isActive
                ? `0 0 0 2px ${text}33`
                : isHovered
                ? `0 0 5px 2px ${text}55`
                : undefined,
            }}
            className="w-5 h-5 rounded-full transition-all cursor-pointer"
            onMouseEnter={() => setHovered(fill)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelect(fill, text)}
          />
        )
      })}
    </div>
  )
}

export function CanvasNodeRenderer({ id, data, width, height, selected }: NodeProps<CanvasNode>) {
  const w = width ?? 160
  const h = height ?? 80

  const [editing, setEditing] = useState(false)
  const [labelValue, setLabelValue] = useState(data.label)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suppressBlurRef = useRef(false)

  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current
      ta.focus()
      ta.setSelectionRange(ta.value.length, ta.value.length)
    }
  }, [editing])

  const updateLabel = useMutation(({ storage }, nodeId: string, label: string) => {
    const flow = storage.get("flow")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveNodes = flow.get("nodes") as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = liveNodes.get(nodeId) as any
    if (!node) return
    const currentData = node.get("data") as CanvasNodeData
    node.set("data", { ...currentData, label })
  }, [])

  const updateColor = useMutation(({ storage }, nodeId: string, fill: string, text: string) => {
    const flow = storage.get("flow")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveNodes = flow.get("nodes") as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = liveNodes.get(nodeId) as any
    if (!node) return
    const currentData = node.get("data") as CanvasNodeData
    node.set("data", { ...currentData, color: fill, textColor: text })
  }, [])

  const enterEdit = useCallback(() => {
    setLabelValue(data.label)
    setEditing(true)
  }, [data.label])

  const commitEdit = useCallback(() => {
    if (suppressBlurRef.current) {
      suppressBlurRef.current = false
      return
    }
    setEditing(false)
    updateLabel(id, labelValue)
  }, [id, labelValue, updateLabel])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        suppressBlurRef.current = true
        setEditing(false)
        setLabelValue(data.label)
      }
    },
    [data.label],
  )

  const textColor = data.textColor ?? "#EDEDED"

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      {selected && (
        <ColorToolbar
          currentFill={data.color}
          onSelect={(fill, text) => updateColor(id, fill, text)}
        />
      )}
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        handleStyle={{
          width: 8,
          height: 8,
          borderRadius: 2,
          background: "var(--accent-primary)",
          border: "none",
          opacity: 1,
        }}
        lineStyle={{
          borderColor: "var(--accent-primary)",
          borderWidth: 1,
          borderStyle: "dashed",
          opacity: 0.5,
        }}
      />
      <BidirectionalHandle position={Position.Top}    side="top"    />
      <BidirectionalHandle position={Position.Right}  side="right"  />
      <BidirectionalHandle position={Position.Bottom} side="bottom" />
      <BidirectionalHandle position={Position.Left}   side="left"   />
      <NodeShapeBody shape={data.shape} w={w} h={h} fill={data.color} selected={selected} />
      <div
        className="absolute inset-0 flex items-center justify-center"
        onDoubleClick={!editing ? enterEdit : undefined}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={labelValue}
            onChange={e => setLabelValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            placeholder="Label…"
            rows={2}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              textAlign: "center",
              color: textColor,
              fontSize: "0.875rem",
              fontWeight: 500,
              lineHeight: 1.25,
              width: "calc(100% - 16px)",
              padding: "0 4px",
              overflow: "hidden",
              caretColor: "var(--accent-primary)",
            }}
          />
        ) : (
          <span
            className="px-2 text-sm font-medium text-center leading-tight select-none pointer-events-none"
            style={{ color: data.label ? textColor : `${textColor}4D` }}
          >
            {data.label || "Label…"}
          </span>
        )}
      </div>
    </div>
  )
}
