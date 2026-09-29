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
import { useMutation, useUpdateMyPresence, useOthers, useEventListener } from "@liveblocks/react"
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

function LiveCursor({ x, y, name, color, thinking }: { x: number; y: number; name: string; color: string; thinking?: boolean }) {
  const { x: vx, y: vy, zoom } = useViewport()
  const sx = x * zoom + vx
  const sy = y * zoom + vy

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: sx, top: sy, zIndex: 50 }}
    >
      {thinking && (
        <div
          className="absolute -top-1 -left-1 w-5 h-5 rounded-full animate-ping opacity-60"
          style={{ backgroundColor: color }}
        />
      )}
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
        {name}{thinking ? "…" : ""}
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
            thinking={other.presence.thinking}
          />
        )
      })}
    </div>
  )
}

// ── Main canvas flow ────────────────────────────────────────────────────────

interface CanvasFlowProps {
  projectId: string
  onCanvasStateChange: (state: { ready: boolean; error: string | null }) => void
  pendingTemplate: PendingTemplate | null
  onTemplateDone: () => void
}

function CanvasFlow({ projectId, onCanvasStateChange, pendingTemplate, onTemplateDone }: CanvasFlowProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const { screenToFlowPosition, fitView } = useReactFlow()
  const updateMyPresence = useUpdateMyPresence()
  const [canvasReady, setCanvasReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const explicitImportRef = useRef(false)
  const saveStatus = useCanvasAutosave(projectId, nodes, edges, canvasReady)

  useEffect(() => {
    onCanvasStateChange({ ready: canvasReady, error: loadError })
  }, [canvasReady, loadError, onCanvasStateChange])
  const [aiStatus, setAiStatus] = useState<string | null>(null)
  const pendingAiFit = useRef(false)
  const prevNodeCountRef = useRef(0)

  useEventListener(({ event }) => {
    if (event.type === "ai-status") {
      setAiStatus(event.status === "complete" || event.status === "error" ? null : event.message)
      if (event.status === "complete" && event.fitView) {
        pendingAiFit.current = true
        setTimeout(() => fitView({ duration: 400 }), 300)
      }
    }
  })

  // Reactive fitView: fires when nodes appear after an AI run completes,
  // covering the case where the storage delta arrives after the broadcastEvent.
  useEffect(() => {
    if (!pendingAiFit.current) return
    if (nodes.length === 0) return
    fitView({ duration: 400 })
    pendingAiFit.current = false
  }, [nodes.length, fitView])

  // Also fit when nodes jump from 0 to >0 during an active AI run (status message showing).
  useEffect(() => {
    const prev = prevNodeCountRef.current
    prevNodeCountRef.current = nodes.length
    if (prev === 0 && nodes.length > 0 && aiStatus !== null) {
      fitView({ duration: 400 })
    }
  }, [nodes.length, aiStatus, fitView])

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

  const restoreSnapshotIfEmpty = useMutation(({ storage }, snapshotNodes: CanvasNode[], snapshotEdges: CanvasEdge[]) => {
    const flow = storage.get("flow")
    const liveNodes = flow.get("nodes")
    const liveEdges = flow.get("edges")
    if (liveNodes.size > 0 || liveEdges.size > 0) return false
    for (const node of snapshotNodes) liveNodes.set(node.id, new LiveObject(node as unknown as ConstructorParameters<typeof LiveObject>[0]) as Parameters<typeof liveNodes.set>[1])
    for (const edge of snapshotEdges) liveEdges.set(edge.id, new LiveObject(edge as unknown as ConstructorParameters<typeof LiveObject>[0]) as Parameters<typeof liveEdges.set>[1])
    return true
  }, [])

  useEffect(() => {
    let canceled = false
    if (nodes.length > 0 || edges.length > 0) {
      queueMicrotask(() => {
        if (!canceled) { setCanvasReady(true); setLoadError(null) }
      })
      return () => { canceled = true }
    }
    void (async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/canvas`)
        if (!response.ok) throw new Error("Could not load the saved canvas. Retry to continue.")
        const data: unknown = await response.json()
        if (!data || typeof data !== "object" || !("canvas" in data)) throw new Error("Saved canvas response is invalid.")
        const snapshot = data.canvas
        if (snapshot !== null) {
          if (!snapshot || typeof snapshot !== "object" || !("nodes" in snapshot) || !("edges" in snapshot)
            || !Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) {
            throw new Error("Saved canvas is invalid. Retry or import a starter template.")
          }
          if (canceled) return
          if (restoreSnapshotIfEmpty(snapshot.nodes as CanvasNode[], snapshot.edges as CanvasEdge[])) {
            setTimeout(() => fitView({ duration: 400 }), 150)
          }
        }
        if (!canceled) setCanvasReady(true)
      } catch (error) {
        if (!canceled && !explicitImportRef.current) setLoadError(error instanceof Error ? error.message : "Could not load the saved canvas.")
      }
    })()
    return () => { canceled = true }
  // Hydration is checked once per attempt; a live mutation rechecks the maps before importing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, loadAttempt])

  const appliedStamp = useRef<number | null>(null)
  const onTemplateDoneRef = useRef(onTemplateDone)
  useEffect(() => { onTemplateDoneRef.current = onTemplateDone }, [onTemplateDone])

  useEffect(() => {
    if (!pendingTemplate || pendingTemplate.stamp === appliedStamp.current) return
    appliedStamp.current = pendingTemplate.stamp
    explicitImportRef.current = true
    importTemplate(pendingTemplate.nodes, pendingTemplate.edges)
    setLoadError(null)
    setCanvasReady(true)
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
      <Panel position="top-left" className="mt-2 ml-2 flex flex-col gap-1">
        <SaveStatusChip status={saveStatus} />
        {loadError && (
          <button className="text-xs px-2 py-1 rounded-lg bg-bg-surface border border-state-error text-state-error" onClick={() => { setLoadError(null); setCanvasReady(false); setLoadAttempt((n) => n + 1) }}>
            {loadError} Retry
          </button>
        )}
        {aiStatus && (
          <span className="text-xs font-medium px-2 py-1 rounded-lg bg-bg-surface border border-accent-ai/40 text-accent-ai-text animate-pulse">
            {aiStatus}
          </span>
        )}
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
  onCanvasStateChange: (state: { ready: boolean; error: string | null }) => void
  pendingTemplate?: PendingTemplate | null
  onTemplateDone?: () => void
}

export function Canvas({ projectId, onCanvasStateChange, pendingTemplate = null, onTemplateDone = () => {} }: CanvasProps) {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <CanvasFlow projectId={projectId} onCanvasStateChange={onCanvasStateChange} pendingTemplate={pendingTemplate} onTemplateDone={onTemplateDone} />
      </ReactFlowProvider>
    </div>
  )
}
