import type { Node, Edge } from "@xyflow/react"

export type NodeShape = "rectangle" | "diamond" | "circle" | "pill" | "cylinder" | "hexagon"

export interface CanvasNodeData extends Record<string, unknown> {
  label: string
  color: string
  shape: NodeShape
}

export type CanvasNode = Node<CanvasNodeData, "canvasNode">
export type CanvasEdge = Edge<Record<string, never>, "canvasEdge">

export const NODE_COLORS: { fill: string; text: string; label: string }[] = [
  { fill: "#1F1F1F", text: "#EDEDED", label: "Neutral" },
  { fill: "#10233D", text: "#52A8FF", label: "Blue" },
  { fill: "#2E1938", text: "#BF7AF0", label: "Purple" },
  { fill: "#331B00", text: "#FF990A", label: "Orange" },
  { fill: "#3C1618", text: "#FF6166", label: "Red" },
  { fill: "#3A1726", text: "#F75F8F", label: "Pink" },
  { fill: "#0F2E18", text: "#62C073", label: "Green" },
  { fill: "#062822", text: "#0AC7B4", label: "Teal" },
]

export const NODE_SHAPES: NodeShape[] = [
  "rectangle",
  "diamond",
  "circle",
  "pill",
  "cylinder",
  "hexagon",
]
