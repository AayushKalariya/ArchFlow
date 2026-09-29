import { createHash } from "node:crypto";
import { z } from "zod";
import type { CanvasEdge, CanvasNode, NodeShape } from "../../types/canvas";
import { NODE_COLORS, NODE_SHAPES } from "../../types/canvas";

const finite = z.number().finite();
const nonempty = z.string().trim().min(1).max(120);
const position = z.object({ x: finite, y: finite });
const shape = z.enum(NODE_SHAPES as [NodeShape, ...NodeShape[]]);
const colorValues = NODE_COLORS.map((entry) => entry.fill);
const color = z.string().refine((value) => colorValues.includes(value), "Unknown node color");

const existingNodeSchema = z.object({
  id: nonempty,
  type: z.literal("canvasNode"),
  position,
  width: finite.positive().optional(),
  height: finite.positive().optional(),
  data: z.object({ label: z.string(), color: z.string(), textColor: z.string().optional(), shape }).passthrough(),
}).passthrough();
const existingEdgeSchema = z.object({
  id: nonempty,
  type: z.literal("canvasEdge"),
  source: nonempty,
  target: nonempty,
  label: z.string().optional(),
}).passthrough();

export interface DesignGraph {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export function readDesignGraph(document: unknown): DesignGraph {
  const root = z.object({ flow: z.object({
    nodes: z.record(z.string(), z.unknown()),
    edges: z.record(z.string(), z.unknown()),
  }) }).safeParse(document);
  if (!root.success) throw new Error("Canvas storage is missing or malformed. Reopen the room and try again.");
  const rawNodes = Object.entries(root.data.flow.nodes);
  const rawEdges = Object.entries(root.data.flow.edges);
  if (rawNodes.length > 160 || rawEdges.length > 320 || JSON.stringify(root.data.flow).length > 60000) {
    throw new Error("Canvas is too large for an AI edit. Please simplify it before trying again.");
  }
  const nodes = rawNodes.map(([key, raw]) => {
    const parsed = existingNodeSchema.safeParse(raw);
    if (!parsed.success || parsed.data.id !== key) throw new Error(`Canvas node ${key} is malformed.`);
    return parsed.data as CanvasNode;
  });
  const edges = rawEdges.map(([key, raw]) => {
    const parsed = existingEdgeSchema.safeParse(raw);
    if (!parsed.success || parsed.data.id !== key) throw new Error(`Canvas edge ${key} is malformed.`);
    return parsed.data as CanvasEdge;
  });
  const ids = new Set(nodes.map((node) => node.id));
  if (edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))) {
    throw new Error("Canvas has an edge with a missing endpoint. Repair the graph before using AI edits.");
  }
  if (nodes.length === 0 && edges.length > 0) throw new Error("Canvas has edges without nodes. Repair it before using AI edits.");
  return { nodes, edges };
}

const newNodeSchema = z.strictObject({ tempId: nonempty, label: nonempty, shape, color });
const newEdgeSchema = z.strictObject({ source: nonempty, target: nonempty, label: z.string().trim().max(120).optional() });
const nodeUpdateSchema = z.strictObject({
  id: nonempty, label: nonempty.optional(), shape: shape.optional(), color: color.optional(),
}).refine((value) => value.label !== undefined || value.shape !== undefined || value.color !== undefined);
const edgeUpdateSchema = z.strictObject({ id: nonempty, label: z.string().trim().max(120) });
export const editPlanSchema = z.strictObject({
  summary: z.string().trim().min(1).max(300),
  addNodes: z.array(newNodeSchema).max(8),
  addEdges: z.array(newEdgeSchema).max(16),
  updateNodes: z.array(nodeUpdateSchema).max(8),
  updateEdges: z.array(edgeUpdateSchema).max(8),
  clarifyingQuestion: z.string().trim().min(1).max(300).nullable(),
});
export type EditPlan = z.infer<typeof editPlanSchema>;

export function expectedAddition(prompt: string): { count: number; type: "database" } | null {
  const match = prompt.toLowerCase().match(/\b(?:add|create|include)\s+(one|two|three|[1-3])\s+(?:more\s+|additional\s+)?(?:\w+\s+){0,2}?(?:database|db|databases)\b/);
  if (!match) return null;
  const counts: Record<string, number> = { one: 1, two: 2, three: 3, "1": 1, "2": 2, "3": 3 };
  return { count: counts[match[1]], type: "database" };
}

export function validateEditPlan(plan: EditPlan, graph: DesignGraph, prompt: string): void {
  const tempIds = new Set(plan.addNodes.map((node) => node.tempId));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  if (tempIds.size !== plan.addNodes.length || [...tempIds].some((id) => nodeIds.has(id))) throw new Error("AI returned duplicate or conflicting node IDs.");
  if (new Set(plan.updateNodes.map((node) => node.id)).size !== plan.updateNodes.length || new Set(plan.updateEdges.map((edge) => edge.id)).size !== plan.updateEdges.length) {
    throw new Error("AI returned duplicate updates.");
  }
  if (plan.clarifyingQuestion) {
    if (plan.addNodes.length || plan.addEdges.length || plan.updateNodes.length || plan.updateEdges.length) throw new Error("A clarification cannot also edit the canvas.");
    return;
  }
  if (plan.updateNodes.some((node) => !nodeIds.has(node.id)) || plan.updateEdges.some((edge) => !edgeIds.has(edge.id))) throw new Error("AI referenced an unknown existing element.");
  const requestText = prompt.toLowerCase();
  for (const update of plan.updateNodes) {
    const target = graph.nodes.find((node) => node.id === update.id)!;
    const label = target.data.label.toLowerCase();
    const named = requestText.includes(update.id.toLowerCase()) || (label.length >= 3 && requestText.includes(label));
    const shapeName = target.data.shape === "cylinder" ? /\b(database|db|storage)\b/ : new RegExp(`\\b${target.data.shape}\\b`);
    const onlyShape = graph.nodes.filter((node) => node.data.shape === target.data.shape).length === 1;
    if (!named && !(onlyShape && shapeName.test(requestText))) throw new Error(`AI update target ${update.id} was not identified in the request.`);
    if (/\b(rename|relabel)\b/.test(requestText) && (update.shape !== undefined || update.color !== undefined)) {
      throw new Error("A rename request may only change the label.");
    }
  }
  for (const update of plan.updateEdges) {
    const target = graph.edges.find((edge) => edge.id === update.id)!;
    const source = graph.nodes.find((node) => node.id === target.source)!;
    const destination = graph.nodes.find((node) => node.id === target.target)!;
    const named = requestText.includes(update.id.toLowerCase())
      || (typeof target.label === "string" && target.label.length >= 3 && requestText.includes(target.label.toLowerCase()))
      || (requestText.includes(source.data.label.toLowerCase()) && requestText.includes(destination.data.label.toLowerCase()));
    if (!named) throw new Error(`AI update target ${update.id} was not identified in the request.`);
  }
  for (const edge of plan.addEdges) {
    if (!(nodeIds.has(edge.source) || tempIds.has(edge.source)) || !(nodeIds.has(edge.target) || tempIds.has(edge.target))) throw new Error("AI returned an edge with an unknown endpoint.");
    if (edge.source === edge.target) throw new Error("AI returned a self-link.");
  }
  if (plan.addNodes.length > 0 && plan.addEdges.length === 0) throw new Error("AI returned disconnected new nodes.");
  if (plan.addNodes.length > 0 && !plan.addEdges.some((edge) => nodeIds.has(edge.source) || nodeIds.has(edge.target))) {
    throw new Error("AI did not connect the addition to the current architecture.");
  }
  const expected = expectedAddition(prompt);
  const additive = !!expected || /\b(?:add|create|include)\s+(?:(?:one|two|three|a|an|another|more|additional)\s+){0,3}(?:api\s+)?(?:gateway|database|db|service|node|queue|cache|replica|load balancer)\b/i.test(prompt);
  if (additive && (plan.updateNodes.length || plan.updateEdges.length)) {
    throw new Error("An additive request cannot change existing elements.");
  }
  if (/\b(rename|relabel|change|update|recolor)\b/i.test(prompt) && !additive && (plan.addNodes.length || plan.addEdges.length)) {
    throw new Error("The requested update cannot add unrelated elements.");
  }
  if (expected && (plan.addNodes.length !== expected.count || plan.addNodes.some((node) => node.shape !== "cylinder"))) {
    throw new Error(`The edit did not match the requested ${expected.count} database node(s). Nothing was changed.`);
  }
}

export function modelGraph(graph: DesignGraph): object {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id, label: node.data.label, shape: node.data.shape,
      color: node.data.color, textColor: node.data.textColor,
      position: node.position, width: node.width, height: node.height,
    })),
    edges: graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label })),
  };
}

export function stableId(runId: string, kind: "node" | "edge", key: string): string {
  return `ai-${kind}-${createHash("sha256").update(`${runId}:${kind}:${key}`).digest("hex").slice(0, 24)}`;
}

export const SHAPE_SIZE: Record<NodeShape, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 }, diamond: { width: 140, height: 140 },
  circle: { width: 100, height: 100 }, pill: { width: 160, height: 60 },
  cylinder: { width: 100, height: 80 }, hexagon: { width: 120, height: 120 },
};

export function placeNewNodes(plan: EditPlan, graph: DesignGraph, runId: string): CanvasNode[] {
  const existing = new Map(graph.nodes.map((node) => [node.id, node]));
  const placed = [...graph.nodes];
  const nodes: CanvasNode[] = [];
  for (const item of plan.addNodes) {
    const attachment = plan.addEdges.find((edge) => edge.source === item.tempId && existing.has(edge.target) || edge.target === item.tempId && existing.has(edge.source));
    const anchor = attachment ? existing.get(attachment.source === item.tempId ? attachment.target : attachment.source) : undefined;
    const boundsX = Math.max(0, ...placed.map((node) => node.position.x + (node.width ?? SHAPE_SIZE[node.data.shape].width)));
    const startX = anchor ? anchor.position.x + (anchor.width ?? SHAPE_SIZE[anchor.data.shape].width) + 100 : boundsX + 100;
    const startY = anchor ? anchor.position.y : 80;
    const size = SHAPE_SIZE[item.shape];
    let chosen = { x: startX, y: startY };
    for (let step = 0; step < 200; step++) {
      const candidate = { x: startX + Math.floor(step / 10) * 220, y: startY + (step % 10) * 130 };
      const collides = placed.some((other) => {
        const otherSize = SHAPE_SIZE[other.data.shape];
        return candidate.x < other.position.x + (other.width ?? otherSize.width) + 40 && candidate.x + size.width + 40 > other.position.x
          && candidate.y < other.position.y + (other.height ?? otherSize.height) + 40 && candidate.y + size.height + 40 > other.position.y;
      });
      if (!collides) { chosen = candidate; break; }
      if (step === 199) throw new Error("Could not find space for the new component.");
    }
    const node: CanvasNode = {
      id: stableId(runId, "node", item.tempId), type: "canvasNode", position: chosen,
      width: size.width, height: size.height,
      data: { label: item.label, shape: item.shape, color: item.color,
        textColor: NODE_COLORS.find((entry) => entry.fill === item.color)!.text },
    };
    nodes.push(node);
    placed.push(node);
  }
  return nodes;
}
