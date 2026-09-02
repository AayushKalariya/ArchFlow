"use client"

import "@xyflow/react/dist/style.css"
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  useReactFlow,
} from "@xyflow/react"
import { useLiveblocksFlow } from "@liveblocks/react-flow"
import { useMutation } from "@liveblocks/react"
import { LiveObject } from "@liveblocks/client"
import { useCallback, type DragEvent } from "react"
import type { CanvasNode, CanvasEdge } from "@/types/canvas"
import { NODE_COLORS } from "@/types/canvas"
import { CanvasNodeRenderer } from "./canvas-node"
import { ShapePanel, type ShapeDragPayload } from "./shape-panel"

const nodeTypes = { canvasNode: CanvasNodeRenderer }

let nodeCounter = 0

function CanvasFlow() {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onDelete } =
    useLiveblocksFlow<CanvasNode, CanvasEdge>({ suspense: true })

  const { screenToFlowPosition } = useReactFlow()

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
      <MiniMap
        style={{ background: "#111114" }}
        maskColor="rgba(0,0,0,0.6)"
        nodeColor="#3a3a42"
        nodeStrokeColor="#2a2a30"
      />
      <Panel position="bottom-center" className="mb-2">
        <ShapePanel />
      </Panel>
    </ReactFlow>
  )
}

export function Canvas() {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <CanvasFlow />
      </ReactFlowProvider>
    </div>
  )
}
