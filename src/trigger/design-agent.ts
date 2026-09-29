import { task, metadata, logger } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { Liveblocks, LiveObject, LiveMap } from "@liveblocks/node";
import dagre from "@dagrejs/dagre";
import type { CanvasNode, CanvasEdge } from "../../types/canvas";
import { NODE_COLORS, NODE_SHAPES } from "../../types/canvas";
import { z } from "zod";
import { editPlanSchema, expectedAddition, modelGraph, placeNewNodes, readDesignGraph, stableId, validateEditPlan, type DesignGraph, type EditPlan } from "./design-graph";

const SYSTEM_PROMPT = `You are a system architecture expert. Generate a system architecture diagram as structured JSON.

Output a JSON object with exactly two keys:
- "nodes": array of node objects
- "edges": array of edge objects

Each node object must have:
- "id": unique string (e.g. "node-1")
- "type": exactly "canvasNode"
- "position": { "x": number, "y": number } — any values; positions are recomputed automatically, so do not worry about spacing or overlap
- "data": {
    "label": string (concise, 1-3 words),
    "color": one of ["#1F1F1F","#10233D","#2E1938","#331B00","#3C1618","#3A1726","#0F2E18","#062822"],
    "textColor": the matching text color for the chosen fill,
    "shape": one of ["rectangle","diamond","circle","pill","cylinder","hexagon"]
  }

Each edge object must have:
- "id": unique string (e.g. "edge-1")
- "type": exactly "canvasEdge"
- "source": node id
- "target": node id

Color → textColor pairs (must match exactly):
"#1F1F1F" → "#EDEDED"
"#10233D" → "#52A8FF"
"#2E1938" → "#BF7AF0"
"#331B00" → "#FF990A"
"#3C1618" → "#FF6166"
"#3A1726" → "#F75F8F"
"#0F2E18" → "#62C073"
"#062822" → "#0AC7B4"

Shape guidance:
- rectangle: services, APIs, gateways, servers
- cylinder: databases, caches, storage
- diamond: load balancers, routers, decision points
- hexagon: external services, third-party systems
- circle: users, clients, browsers, endpoints
- pill: queues, message brokers, streams, pipelines

Layout rules:
- Generate 5 to 12 nodes
- Group related components, connect with directional edges
- Orient edges to follow the main request/data flow (top-to-bottom); positioning and spacing are handled automatically

Respond with ONLY valid JSON — no markdown fences, no explanation text.`;

const AI_USER_ID = "ghost-ai";
const AI_USER_INFO = { name: "Ghost AI", avatar: "", color: "#6457f9" };

// Node dimensions per shape — must match the sizes used by the shape panel /
// templates. React Flow lays out (and paints) nodes by their width/height; a
// node written to storage without dimensions never gets measured in the
// controlled `useLiveblocksFlow` setup and stays invisible. The model does not
// reliably emit these, so we always normalize them here.
const SHAPE_SIZE: Record<string, { width: number; height: number }> = {
  rectangle: { width: 160, height: 80 },
  diamond: { width: 140, height: 140 },
  circle: { width: 100, height: 100 },
  pill: { width: 160, height: 60 },
  cylinder: { width: 100, height: 80 },
  hexagon: { width: 120, height: 120 },
};

function normalizeNode(node: CanvasNode): CanvasNode {
  const shape = node.data?.shape;
  const size = (shape && SHAPE_SIZE[shape]) || { width: 160, height: 80 };
  return {
    ...node,
    type: "canvasNode",
    width: node.width ?? size.width,
    height: node.height ?? size.height,
  };
}

// Deterministic auto-layout. The model is unreliable at spatial positioning and
// routinely emits overlapping nodes, so we discard its coordinates and recompute
// them with dagre from the graph structure + real node dimensions. Guarantees no
// overlap and a readable top-to-bottom flow. dagre positions are node centers;
// React Flow expects the top-left corner, so we offset by half width/height.
function layoutNodes(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  const dims = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const width = node.width ?? 160;
    const height = node.height ?? 80;
    dims.set(node.id, { width, height });
    g.setNode(node.id, { width, height });
  }

  for (const edge of edges) {
    if (edge.source && edge.target && dims.has(edge.source) && dims.has(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const { x, y } = g.node(node.id) ?? { x: 0, y: 0 };
    const { width, height } = dims.get(node.id)!;
    return { ...node, position: { x: x - width / 2, y: y - height / 2 } };
  });
}

function getLiveblocks() {
  return new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! });
}

const createNodeSchema = z.object({
  id: z.string().trim().min(1), type: z.literal("canvasNode"),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }),
  data: z.object({
    label: z.string().trim().min(1),
    color: z.string().refine((value) => NODE_COLORS.some((color) => color.fill === value)),
    textColor: z.string(),
    shape: z.enum(NODE_SHAPES as [typeof NODE_SHAPES[number], ...typeof NODE_SHAPES[number][]]),
  }),
});
const createEdgeSchema = z.object({
  id: z.string().trim().min(1), type: z.literal("canvasEdge"),
  source: z.string().min(1), target: z.string().min(1),
  label: z.string().optional(),
});
const createGraphSchema = z.object({ nodes: z.array(createNodeSchema).min(1).max(16), edges: z.array(createEdgeSchema).max(32) });

const EDIT_PROMPT = `You are editing an existing system architecture canvas. Return ONLY a JSON object with exactly these keys:
{"summary":"short description","addNodes":[{"tempId":"local-1","label":"Read Replica","shape":"cylinder","color":"#10233D"}],"addEdges":[{"source":"existing-or-temp-id","target":"existing-or-temp-id","label":"optional relationship"}],"updateNodes":[{"id":"existing-id","label":"optional new label","shape":"optional shape","color":"optional fill"}],"updateEdges":[{"id":"existing-edge-id","label":"new label"}],"clarifyingQuestion":null}
Use the smallest change satisfying the request. Keep every existing node and edge, ID, label, style, size, and position unless the user explicitly requests a specific field update. Never delete, replace, or reposition anything. New tempIds are local to this response; never invent permanent IDs. Connect added nodes meaningfully. If the target or architectural choice is ambiguous, return empty operation arrays and a clarifyingQuestion. For overloaded databases, ask whether pressure is reads, writes, or storage unless the canvas/request establishes it. A read replica only addresses read pressure. Respect explicit counts exactly. Allowed shapes: rectangle, diamond, circle, pill, cylinder, hexagon. Allowed colors: ${NODE_COLORS.map((entry) => entry.fill).join(", ")}. No markdown.`;

class CanvasChangedError extends Error {}

function parseJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); }
  catch { throw new Error("AI returned invalid JSON. The canvas was not changed."); }
}

function validateCreate(raw: unknown): DesignGraph {
  const result = createGraphSchema.safeParse(raw);
  if (!result.success) throw new Error("AI returned an invalid initial design. The canvas was not changed.");
  const nodes = result.data.nodes;
  const edges = result.data.edges;
  const ids = new Set(nodes.map((node) => node.id));
  if (ids.size !== nodes.length || new Set(edges.map((edge) => edge.id)).size !== edges.length
    || edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target)
    || nodes.some((node) => NODE_COLORS.find((color) => color.fill === node.data.color)?.text !== node.data.textColor)) {
    throw new Error("AI returned conflicting IDs, edges, or colors. The canvas was not changed.");
  }
  const reached = new Set<string>([nodes[0].id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of edges) {
      if (reached.has(edge.source) && !reached.has(edge.target)) { reached.add(edge.target); changed = true; }
      if (reached.has(edge.target) && !reached.has(edge.source)) { reached.add(edge.source); changed = true; }
    }
  }
  if (reached.size !== nodes.length) throw new Error("AI returned a disconnected initial design. The canvas was not changed.");
  return {
    nodes: layoutNodes(nodes.map((node) => normalizeNode(node as CanvasNode)), edges as CanvasEdge[]),
    edges: edges as CanvasEdge[],
  };
}

function graphFromRoot(root: { toJSON(): unknown }): DesignGraph {
  return readDesignGraph(root.toJSON());
}

export const designAgent = task({
  id: "design-agent",
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 2 },
  run: async (payload: { prompt: string; roomId: string }, { ctx }) => {
    const { prompt, roomId } = payload;
    const runId = ctx.run.id;
    const liveblocks = getLiveblocks();
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const finish = async (summary: string, actionsApplied: number, fitView: boolean) => {
      metadata.set("status", "complete").set("message", summary);
      await liveblocks.broadcastEvent(roomId, { type: "ai-status", status: "complete", message: summary, fitView });
      return { success: true, actionsApplied, summary };
    };
    metadata.set("status", "starting").set("message", "Reading the current canvas…");
    try {
      await liveblocks.setPresence(roomId, {
        userId: AI_USER_ID, data: { thinking: true, cursor: { x: 600, y: 350 } },
        userInfo: AI_USER_INFO, ttl: 120,
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const document = await liveblocks.getStorageDocument(roomId, "json");
        const graph = readDesignGraph(document);
        const appliedRuns = (document as { appliedAiRuns?: Record<string, string> }).appliedAiRuns;
        if (appliedRuns?.[runId]) return await finish(appliedRuns[runId], 0, false);
        const isCreate = graph.nodes.length === 0 && graph.edges.length === 0;
        const status = isCreate ? "Creating an initial architecture…" : "Planning a small edit to the current canvas…";
        metadata.set("status", "processing").set("message", status);
        await liveblocks.broadcastEvent(roomId, { type: "ai-status", status: "processing", message: status });

        if (!isCreate && /\b(?:overload(?:ed)?|overloaded|bottleneck)\b/i.test(prompt)
          && /\b(?:database|db)\b/i.test(prompt)
          && !/\b(?:read|reads|write|writes|storage|disk|capacity|shard)\b/i.test(prompt)) {
          return await finish("Is the database overloaded by reads, writes, or storage? That determines which additional database or storage change would help.", 0, false);
        }

        let created: DesignGraph | null = null;
        let plan: EditPlan | null = null;
        if (isCreate) {
          const result = await generateText({ model: anthropic("claude-sonnet-4-6"), system: SYSTEM_PROMPT,
            prompt: `Design a system architecture for: ${prompt}`, maxOutputTokens: 4096 });
          created = validateCreate(parseJson(result.text));
        } else {
          const expectation = expectedAddition(prompt);
          const input = `Current canvas:\n${JSON.stringify(modelGraph(graph))}\n\nUser request: ${prompt}\n${expectation ? `Add exactly ${expectation.count} database node(s), with only necessary edges.` : ""}`;
          for (let generation = 0; generation < 2; generation++) {
            const result = await generateText({ model: anthropic("claude-sonnet-4-6"), system: EDIT_PROMPT,
              prompt: generation === 0 ? input : `${input}\nYour previous plan violated the requested count or shape. Correct it exactly.`, maxOutputTokens: 3000 });
            const parsed = editPlanSchema.safeParse(parseJson(result.text));
            if (!parsed.success) throw new Error("AI returned an invalid edit plan. The canvas was not changed.");
            plan = parsed.data;
            try { validateEditPlan(plan, graph, prompt); break; }
            catch (error) {
              if (!expectation || generation === 1) throw error;
            }
          }
          if (!plan) throw new Error("AI did not return an edit plan.");
          if (plan.clarifyingQuestion) {
            return await finish(plan.clarifyingQuestion, 0, false);
          }
          if (!plan.addNodes.length && !plan.addEdges.length && !plan.updateNodes.length && !plan.updateEdges.length) {
            return await finish(`No canvas changes were needed. ${plan.summary}`, 0, false);
          }
        }

        metadata.set("status", "applying").set("message", "Applying validated canvas changes…");
        let actionsApplied = 0;
        let summary = "";
        try {
          await liveblocks.mutateStorage(roomId, ({ root }) => {
            const current = graphFromRoot(root);
            let marker = root.get("appliedAiRuns");
            if (marker?.get(runId)) { summary = marker.get(runId)!; return; }
            const flow = root.get("flow");
            if (!flow) throw new Error("Canvas storage is missing its flow maps.");
            const liveNodes = flow.get("nodes");
            const liveEdges = flow.get("edges");
            if (created) {
              if (current.nodes.length || current.edges.length) throw new CanvasChangedError("Canvas changed during initial generation.");
              for (const node of created.nodes) liveNodes.set(node.id, new LiveObject(node as unknown as ConstructorParameters<typeof LiveObject>[0]) as Parameters<typeof liveNodes.set>[1]);
              for (const edge of created.edges) liveEdges.set(edge.id, new LiveObject(edge as unknown as ConstructorParameters<typeof LiveObject>[0]) as Parameters<typeof liveEdges.set>[1]);
              actionsApplied = created.nodes.length + created.edges.length;
              summary = `Created an architecture with ${created.nodes.length} components and ${created.edges.length} connections.`;
            } else if (plan) {
              // Validate every target against the latest room state before issuing any writes.
              const oldNodes = new Map(graph.nodes.map((node) => [node.id, node]));
              const oldEdges = new Map(graph.edges.map((edge) => [edge.id, edge]));
              const nowNodes = new Map(current.nodes.map((node) => [node.id, node]));
              const nowEdges = new Map(current.edges.map((edge) => [edge.id, edge]));
              const referencedNodeIds = new Set([
                ...plan.updateNodes.map((node) => node.id),
                ...plan.addEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => oldNodes.has(id)),
              ]);
              for (const id of referencedNodeIds) {
                if (!nowNodes.has(id) || JSON.stringify(nowNodes.get(id)) !== JSON.stringify(oldNodes.get(id))) {
                  throw new CanvasChangedError(`A referenced component changed while AI was working (${id}).`);
                }
              }
              for (const update of plan.updateEdges) {
                if (!nowEdges.has(update.id) || JSON.stringify(nowEdges.get(update.id)) !== JSON.stringify(oldEdges.get(update.id))) {
                  throw new CanvasChangedError(`A referenced connection changed while AI was working (${update.id}).`);
                }
              }
              const newNodes = placeNewNodes(plan, current, runId);
              const tempToId = new Map(plan.addNodes.map((item, index) => [item.tempId, newNodes[index].id]));
              const newEdges: CanvasEdge[] = plan.addEdges.map((edge, index) => ({
                id: stableId(runId, "edge", String(index)), type: "canvasEdge",
                source: tempToId.get(edge.source) ?? edge.source,
                target: tempToId.get(edge.target) ?? edge.target,
                ...(edge.label ? { label: edge.label } : {}),
              }));
              if (newNodes.some((node) => nowNodes.has(node.id)) || newEdges.some((edge) => nowEdges.has(edge.id))) throw new CanvasChangedError("Generated IDs already exist in the room.");
              for (const item of newNodes) liveNodes.set(item.id, new LiveObject(item as unknown as ConstructorParameters<typeof LiveObject>[0]) as Parameters<typeof liveNodes.set>[1]);
              for (const item of newEdges) liveEdges.set(item.id, new LiveObject(item as unknown as ConstructorParameters<typeof LiveObject>[0]) as Parameters<typeof liveEdges.set>[1]);
              for (const update of plan.updateNodes) {
                const target = liveNodes.get(update.id)!;
                const data = target.get("data") as unknown as CanvasNode["data"];
                target.set("data", {
                  ...data,
                  ...(update.label !== undefined ? { label: update.label } : {}),
                  ...(update.shape !== undefined ? { shape: update.shape } : {}),
                  ...(update.color !== undefined ? { color: update.color, textColor: NODE_COLORS.find((item) => item.fill === update.color)!.text } : {}),
                } as never);
              }
              for (const update of plan.updateEdges) liveEdges.get(update.id)!.set("label", update.label);
              actionsApplied = newNodes.length + newEdges.length + plan.updateNodes.length + plan.updateEdges.length;
              const parts = [];
              if (newNodes.length) parts.push(`added ${newNodes.length} component${newNodes.length === 1 ? "" : "s"} (${newNodes.map((node) => node.data.label).join(", ")})`);
              if (newEdges.length) parts.push(`added ${newEdges.length} connection${newEdges.length === 1 ? "" : "s"}`);
              if (plan.updateNodes.length || plan.updateEdges.length) parts.push(`updated ${plan.updateNodes.length + plan.updateEdges.length} existing element${plan.updateNodes.length + plan.updateEdges.length === 1 ? "" : "s"}`);
              summary = `Ghost AI ${parts.join(" and ")}.`;
            }
            if (!marker) { marker = new LiveMap<string, string>(); root.set("appliedAiRuns", marker); }
            marker.set(runId, summary);
          });
        } catch (error) {
          if (error instanceof CanvasChangedError && attempt === 0) continue;
          throw error;
        }
        return await finish(summary, actionsApplied, isCreate);
      }
      throw new Error("Canvas changed while AI was working. Please try again.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Design request failed.";
      logger.error("design-agent failed", { error: message });
      metadata.set("status", "error").set("message", message);
      await liveblocks.broadcastEvent(roomId, { type: "ai-status", status: "error", message }).catch(() => {});
      throw error;
    } finally {
      await liveblocks.setPresence(roomId, {
        userId: AI_USER_ID, data: { thinking: false, cursor: null }, userInfo: AI_USER_INFO, ttl: 2,
      }).catch(() => {});
    }
  },
});
