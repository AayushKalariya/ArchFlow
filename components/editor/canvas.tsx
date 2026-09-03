"use client"

import "@xyflow/react/dist/style.css"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
  useViewport,
} from "@xyflow/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import { useMutation, useUpdateMyPresence, useOthers } from "@liveblocks/react"
import { LiveObject } from "@liveblocks/client"
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react"
import type { CanvasNode, CanvasEdge } from "@/types/canvas"
import { NODE_COLORS } from "@/types/canvas"
import { CanvasNodeRenderer } from "./canvas-node"
import { CanvasEdgeRenderer } from "./canvas-edge"
import { ShapePanel, type ShapeDragPayload } from "./shape-panel"
import { CanvasControls } from "./canvas-controls"
import { PresenceBar } from "./presence-bar"
import type { PendingTemplate } from "./starter-templates"
import { useCanvasAutosave } from "@/hooks/use-canvas-autosave"

const nodeTypes = { canvasNode: CanvasNodeRenderer }
const edgeTypes = { canvasEdge: CanvasEdgeRenderer }

let nodeCounter = 0

// ── Live cursor for a single other participant ──────────────────────────────

function LiveCursor({ x, y, name, color }: { x: number; y: number; name: string; color: string }) {
  const { x: vx, y: vy, zoom } = useViewport()
  const sx = x * zoom + vx
  const sy = y * zoom + vy

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: sx, top: sy, zIndex: 50 }}
    >
      <svg width="16" height="20" viewBox="0 0 16 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M0 0L0 15L4 11L7 17L9 16L6 10L11 10Z"
          fill={color}
          stroke="#000000"
          strokeWidth="0.75"
          strokeLinejoin="round"
        />
      </svg>
      <div
        className="mt-0.5 px-2 py-0.5 rounded-md text-xs font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: color }}
      >
        {name}
      </div>
    </div>
  )
}

// ── Renders all other participants' cursors ─────────────────────────────────

function LiveCursors() {
  const others = useOthers()

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {others.map((other) => {
        if (!other.presence.cursor) return null
        return (
          <LiveCursor
            key={other.connectionId}
            x={other.presence.cursor.x}
            y={other.presence.cursor.y}
            name={other.info?.name ?? "User"}
            color={other.info?.color ?? "#808090"}
          />
        )
      })}
    </div>
  )
}

// ── Main canvas flow ────────────────────────────────────────────────────────

interface CanvasFlowProps {
  projectId: string
  pendingTemplate: PendingTemplate | null
  onTemplateDone: () => void
}

function CanvasFlow({ projectId, pendingTemplate, onTemplateDone }: CanvasFlowProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const { screenToFlowPosition, fitView } = useReactFlow()
  const updateMyPresence = useUpdateMyPresence()
  const saveStatus = useCanvasAutosave(projectId, nodes, edges)

  const [editingEdge, setEditingEdge] = useState<{ id: string; x: number; y: number; label: string } | null>(null)

  const updateEdgeLabel = useMutation(({ storage }, id: string, label: string) => {
    const flow = storage.get("flow")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveEdges = flow.get("edges") as any
    const edge = liveEdges.get(id)
    if (!edge) return
    edge.set("label", label)
    edge.set("type", "canvasEdge")
  }, [])

  const onEdgeDoubleClick = useCallback((event: MouseEvent, edge: CanvasEdge) => {
    setEditingEdge({
      id: edge.id,
      x: event.clientX,
      y: event.clientY,
      label: typeof edge.label === "string" ? edge.label : "",
    })
  }, [])

  const importTemplate = useMutation(({ storage }, templateNodes: CanvasNode[], templateEdges: CanvasEdge[]) => {
    const flow = storage.get("flow")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveNodes = flow.get("nodes") as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const liveEdges = flow.get("edges") as any

    for (const k of [...liveNodes.keys()]) liveNodes.delete(k)
    for (const k of [...liveEdges.keys()]) liveEdges.delete(k)

    for (const node of templateNodes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      liveNodes.set(node.id, new LiveObject(node as any))
    }
    for (const edge of templateEdges) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      liveEdges.set(edge.id, new LiveObject(edge as any))
    }
  }, [])

  const roomLoaded = useRef(false)
  useEffect(() => {
    if (roomLoaded.current) return
    roomLoaded.current = true
    if (nodes.length > 0 || edges.length > 0) return

    fetch(`/api/projects/${projectId}/canvas`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { canvas: { nodes: CanvasNode[]; edges: CanvasEdge[] } | null } | null) => {
        if (!data?.canvas) return
        importTemplate(data.canvas.nodes, data.canvas.edges)
        setTimeout(() => fitView({ duration: 400 }), 150)
      })
      .catch(() => {})
  // run once on mount — nodes/edges checked at that point reflect room storage state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const appliedStamp = useRef<number | null>(null)
  const onTemplateDoneRef = useRef(onTemplateDone)
  useEffect(() => { onTemplateDoneRef.current = onTemplateDone }, [onTemplateDone])

  useEffect(() => {
    if (!pendingTemplate || pendingTemplate.stamp === appliedStamp.current) return
    appliedStamp.current = pendingTemplate.stamp
    importTemplate(pendingTemplate.nodes, pendingTemplate.edges)
    setTimeout(() => fitView({ duration: 400 }), 150)
    onTemplateDoneRef.current()
  }, [pendingTemplate, importTemplate, fitView])

  const addNode = useMutation(({ storage }, node: CanvasNode) => {
    const flow = storage.get("flow")
    const liveNodes = flow.get("nodes")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(liveNodes as any).set(node.id, new LiveObject(node as any))
  }, [])

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "copy"
  }, [])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const raw = e.dataTransfer.getData("application/ghost-shape")
      if (!raw) return
      const payload: ShapeDragPayload = JSON.parse(raw)
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const id = `${payload.shape}-${Date.now()}-${++nodeCounter}`
      const node: CanvasNode = {
        id,
        type: "canvasNode",
        position,
        width: payload.width,
        height: payload.height,
        data: {
          label: "",
          color: NODE_COLORS[0].fill,
          shape: payload.shape,
        },
      }
      addNode(node)
    },
    [screenToFlowPosition, addNode],
  )

  const onMouseMove = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      updateMyPresence({ cursor: pos })
    },
    [screenToFlowPosition, updateMyPresence],
  )

  const onMouseLeave = useCallback(() => {
    updateMyPresence({ cursor: null })
  }, [updateMyPresence])

  return (
    <>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDelete={onDelete}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      defaultEdgeOptions={{ type: "canvasEdge" }}
      onEdgeDoubleClick={onEdgeDoubleClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      connectOnClick
      fitView
    >
      <Background variant={BackgroundVariant.Dots} />
      <LiveCursors />
      <Panel position="top-right" className="mt-2 mr-2">
        <PresenceBar />
      </Panel>
      <Panel position="top-left" className="mt-2 ml-2">
        <SaveStatusChip status={saveStatus} />
      </Panel>
      <Panel position="bottom-left" className="mb-2 ml-2">
        <CanvasControls />
      </Panel>
      <Panel position="bottom-center" className="mb-2">
        <ShapePanel />
      </Panel>
    </ReactFlow>
    {editingEdge && (
      <div
        className="fixed z-50"
        style={{ left: editingEdge.x, top: editingEdge.y, transform: "translate(-50%, -50%)" }}
      >
        <input
          autoFocus
          value={editingEdge.label}
          onChange={e => setEditingEdge(prev => prev ? { ...prev, label: e.target.value } : null)}
          onBlur={() => {
            updateEdgeLabel(editingEdge.id, editingEdge.label)
            setEditingEdge(null)
          }}
          onKeyDown={e => {
            if (e.key === "Enter") {
              updateEdgeLabel(editingEdge.id, editingEdge.label)
              setEditingEdge(null)
            } else if (e.key === "Escape") {
              setEditingEdge(null)
            }
          }}
          className="bg-bg-base border border-border-default text-text-primary text-xs px-3 py-1.5 rounded-full outline-none focus:border-border-strong min-w-[120px] text-center"
          placeholder="Add label…"
        />
      </div>
    )}
    </>
  )
}

// ── Save status chip ────────────────────────────────────────────────────────

import type { SaveStatus } from "@/hooks/use-canvas-autosave"

function SaveStatusChip({ status }: { status: SaveStatus }) {
  if (status === "idle") return null
  const label =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : "Save error"
  const cls =
    status === "saving"
      ? "text-text-muted"
      : status === "saved"
        ? "text-text-secondary"
        : "text-red-400"
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-lg bg-bg-surface border border-border-default ${cls}`}>
      {label}
    </span>
  )
}

// ── Public export ───────────────────────────────────────────────────────────

interface CanvasProps {
  projectId: string
  pendingTemplate?: PendingTemplate | null
  onTemplateDone?: () => void
}

export function Canvas({ projectId, pendingTemplate = null, onTemplateDone = () => {} }: CanvasProps) {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <CanvasFlow projectId={projectId} pendingTemplate={pendingTemplate} onTemplateDone={onTemplateDone} />
      </ReactFlowProvider>
    </div>
  )
}
