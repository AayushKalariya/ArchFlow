"use client"

import "@xyflow/react/dist/style.css"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  useReactFlow,
} from "@xyflow/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import { useMutation } from "@liveblocks/react"
import { LiveObject } from "@liveblocks/client"
import { useCallback, useEffect, useRef, type DragEvent } from "react"
import type { CanvasNode, CanvasEdge } from "@/types/canvas"
import { NODE_COLORS } from "@/types/canvas"
import { CanvasNodeRenderer } from "./canvas-node"
import { ShapePanel, type ShapeDragPayload } from "./shape-panel"
import { CanvasControls } from "./canvas-controls"
import type { PendingTemplate } from "./starter-templates"

const nodeTypes = { canvasNode: CanvasNodeRenderer }

let nodeCounter = 0

interface CanvasFlowProps {
  pendingTemplate: PendingTemplate | null
  onTemplateDone: () => void
}

function CanvasFlow({ pendingTemplate, onTemplateDone }: CanvasFlowProps) {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const { screenToFlowPosition, fitView } = useReactFlow()

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
    // CanvasNodeData extends Record<string,unknown> for ReactFlow compat, but
    // Liveblocks needs LsonObject. Values are plain JSON at runtime so this is safe.
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDelete={onDelete}
      nodeTypes={nodeTypes}
      onDragOver={onDragOver}
      onDrop={onDrop}
      connectOnClick
      fitView
    >
      <Background variant={BackgroundVariant.Dots} />
      <Panel position="bottom-left" className="mb-2 ml-2">
        <CanvasControls />
      </Panel>
      <Panel position="bottom-center" className="mb-2">
        <ShapePanel />
      </Panel>
    </ReactFlow>
  )
}

interface CanvasProps {
  pendingTemplate?: PendingTemplate | null
  onTemplateDone?: () => void
}

export function Canvas({ pendingTemplate = null, onTemplateDone = () => {} }: CanvasProps) {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <CanvasFlow pendingTemplate={pendingTemplate} onTemplateDone={onTemplateDone} />
      </ReactFlowProvider>
    </div>
  )
}
