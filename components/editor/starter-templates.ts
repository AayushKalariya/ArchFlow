import type { CanvasNode, CanvasEdge, NodeShape } from "@/types/canvas"
import { NODE_COLORS } from "@/types/canvas"

export interface CanvasTemplate {
  id: string
  name: string
  description: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
}

export interface PendingTemplate {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  stamp: number
}

function n(
  id: string,
  label: string,
  x: number,
  y: number,
  shape: NodeShape,
  colorIdx: number,
  w = 140,
  h = 60,
): CanvasNode {
  return {
    id,
    type: "canvasNode",
    position: { x, y },
    width: w,
    height: h,
    data: {
      label,
      shape,
      color: NODE_COLORS[colorIdx].fill,
      textColor: NODE_COLORS[colorIdx].text,
    },
  }
}

function e(id: string, source: string, target: string): CanvasEdge {
  return { id, source, target, type: "canvasEdge" }
}

export const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    id: "microservices",
    name: "Microservices",
    description: "API gateway routing to independent services with a shared database layer.",
    nodes: [
      n("gw",    "API Gateway",      280,   0, "rectangle", 1),
      n("auth",  "Auth Service",       0, 120, "rectangle", 2),
      n("user",  "User Service",     160, 120, "rectangle", 7),
      n("prod",  "Product Service",  320, 120, "rectangle", 0),
      n("order", "Order Service",    480, 120, "rectangle", 3),
      n("db",    "Database",         280, 260, "cylinder",  6),
    ],
    edges: [
      e("gw-auth",  "gw",    "auth"),
      e("gw-user",  "gw",    "user"),
      e("gw-prod",  "gw",    "prod"),
      e("gw-order", "gw",    "order"),
      e("user-db",  "user",  "db"),
      e("prod-db",  "prod",  "db"),
      e("order-db", "order", "db"),
    ],
  },
  {
    id: "cicd",
    name: "CI/CD Pipeline",
    description: "Automated build, test, and deployment pipeline from source to production.",
    nodes: [
      n("src",     "Source Control", 0,   60, "rectangle", 1),
      n("build",   "Build",         180,  60, "rectangle", 3),
      n("test",    "Test",          360,  60, "rectangle", 4),
      n("staging", "Staging",       540,  60, "rectangle", 2),
      n("deploy",  "Deploy",        720,  40, "diamond",   6, 100, 100),
      n("prodenv", "Production",    900,  60, "pill",      7),
    ],
    edges: [
      e("src-build",     "src",     "build"),
      e("build-test",    "build",   "test"),
      e("test-staging",  "test",    "staging"),
      e("staging-deploy","staging", "deploy"),
      e("deploy-prod",   "deploy",  "prodenv"),
    ],
  },
  {
    id: "event-driven",
    name: "Event-Driven System",
    description: "Producer publishes events to a bus consumed by multiple independent services.",
    nodes: [
      n("producer", "Producer",         200,   0, "pill",      1),
      n("bus",      "Event Bus",        200, 140, "hexagon",   3, 160, 80),
      n("consA",    "Consumer A",         0, 280, "rectangle", 7),
      n("consB",    "Consumer B",       200, 280, "rectangle", 2),
      n("consC",    "Consumer C",       400, 280, "rectangle", 6),
      n("dlq",      "Dead Letter Queue",560, 140, "cylinder",  4),
    ],
    edges: [
      e("p-bus",    "producer", "bus"),
      e("bus-a",    "bus",      "consA"),
      e("bus-b",    "bus",      "consB"),
      e("bus-c",    "bus",      "consC"),
      e("consA-dlq","consA",    "dlq"),
    ],
  },
]
