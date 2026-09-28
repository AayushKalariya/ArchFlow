import { task, metadata, logger } from "@trigger.dev/sdk";
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { Liveblocks, LiveObject } from "@liveblocks/node";
import dagre from "@dagrejs/dagre";
import type { CanvasNode, CanvasEdge } from "../../types/canvas";

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

export const designAgent = task({
  id: "design-agent",
  retry: { maxAttempts: 2 },
  run: async (payload: { prompt: string; roomId: string }) => {
    const { prompt, roomId } = payload;
    const liveblocks = getLiveblocks();

    metadata.set("status", "starting").set("message", "Ghost AI is starting…");

    // Announce AI presence with thinking cursor
    await liveblocks.setPresence(roomId, {
      userId: AI_USER_ID,
      data: { thinking: true, cursor: { x: 600, y: 350 } },
      userInfo: AI_USER_INFO,
      ttl: 120,
    });

    await liveblocks.broadcastEvent(roomId, {
      type: "ai-status",
      status: "processing",
      message: "Ghost AI is designing your architecture…",
    });

    metadata.set("status", "processing").set("message", "Generating design with Claude…");

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    let parsed: { nodes: CanvasNode[]; edges: CanvasEdge[] };

    try {
      const result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: SYSTEM_PROMPT,
        prompt: `Design a system architecture for: ${prompt}`,
        maxOutputTokens: 4096,
      });

      const text = result.text.trim();
      const match = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : text) as { nodes: CanvasNode[]; edges: CanvasEdge[] };

      // Ensure every node carries the dimensions React Flow needs to render it.
      parsed.nodes = (parsed.nodes ?? []).map(normalizeNode);
      parsed.edges = (parsed.edges ?? []).map((edge) => ({ ...edge, type: "canvasEdge" as const }));

      if (parsed.nodes.length === 0) {
        throw new Error("Model returned no nodes");
      }

      // Discard model coordinates; recompute a clean, non-overlapping layout.
      parsed.nodes = layoutNodes(parsed.nodes, parsed.edges);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("AI generation failed", { error: msg });

      metadata.set("status", "error").set("message", "Failed to generate design.");
      await liveblocks.broadcastEvent(roomId, {
        type: "ai-status",
        status: "error",
        message: "Design generation failed. Please try again.",
      });
      await liveblocks.setPresence(roomId, {
        userId: AI_USER_ID,
        data: { thinking: false, cursor: null },
        userInfo: AI_USER_INFO,
        ttl: 2,
      });
      throw err;
    }

    metadata.set("status", "applying").set("message", "Applying design to canvas…");

    // Move cursor to signal canvas work
    await liveblocks.setPresence(roomId, {
      userId: AI_USER_ID,
      data: { thinking: true, cursor: { x: 400, y: 280 } },
      userInfo: AI_USER_INFO,
      ttl: 60,
    });

    // Apply generated nodes and edges to the shared Liveblocks canvas
    try {
      await liveblocks.mutateStorage(roomId, ({ root }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const flow = root.get("flow") as any;
        if (!flow) {
          throw new Error("Liveblocks storage 'flow' key not found — room may not be initialized");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveNodes = flow.get("nodes") as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveEdges = flow.get("edges") as any;

        for (const k of [...liveNodes.keys()]) liveNodes.delete(k);
        for (const k of [...liveEdges.keys()]) liveEdges.delete(k);

        for (const node of parsed.nodes) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          liveNodes.set(node.id, new LiveObject(node as any));
        }
        for (const edge of parsed.edges) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          liveEdges.set(edge.id, new LiveObject(edge as any));
        }
      });
    } catch (storageErr) {
      const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
      logger.error("mutateStorage failed", { error: msg });
      metadata.set("status", "error").set("message", "Failed to apply design to canvas.");
      await liveblocks.broadcastEvent(roomId, {
        type: "ai-status",
        status: "error",
        message: "Design generated but failed to apply to canvas. Please try again.",
      });
      await liveblocks.setPresence(roomId, {
        userId: AI_USER_ID,
        data: { thinking: false, cursor: null },
        userInfo: AI_USER_INFO,
        ttl: 2,
      });
      throw storageErr;
    }

    await liveblocks.broadcastEvent(roomId, {
      type: "ai-status",
      status: "complete",
      message: "Ghost AI has updated your canvas.",
    });

    metadata.set("status", "complete").set("message", "Design applied to canvas.");

    // Clear AI presence
    await liveblocks.setPresence(roomId, {
      userId: AI_USER_ID,
      data: { thinking: false, cursor: null },
      userInfo: AI_USER_INFO,
      ttl: 2,
    });

    logger.log("design-agent complete", { nodes: parsed.nodes.length, edges: parsed.edges.length });
    return {
      success: true,
      actionsApplied: parsed.nodes.length + parsed.edges.length,
      summary: `Designed architecture with ${parsed.nodes.length} nodes and ${parsed.edges.length} edges: ${parsed.nodes.map((n) => n.data.label).join(", ")}.`,
    };
  },
});
