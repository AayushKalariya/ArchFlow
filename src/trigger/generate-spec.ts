import { schemaTask, metadata, logger } from "@trigger.dev/sdk";
import { z } from "zod";

// Loose canvas shapes — the task consumes the canvas as context only; it does
// not mutate storage, so we validate the useful fields and passthrough the rest
// rather than duplicating the strict types/canvas.ts model here.
const nodeSchema = z
  .object({
    id: z.string(),
    data: z
      .object({
        label: z.string().optional(),
        shape: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const edgeSchema = z
  .object({
    id: z.string(),
    source: z.string().optional(),
    target: z.string().optional(),
  })
  .passthrough();

const chatMessageSchema = z
  .object({
    role: z.string().optional(),
    sender: z.string().optional(),
    senderName: z.string().optional(),
    content: z.string(),
  })
  .passthrough();

const generateSpecSchema = z.object({
  projectId: z.string().min(1),
  roomId: z.string().min(1),
  chatHistory: z.array(chatMessageSchema).default([]),
  nodes: z.array(nodeSchema).default([]),
  edges: z.array(edgeSchema).default([]),
});

export type GenerateSpecPayload = z.infer<typeof generateSpecSchema>;

const SYSTEM_PROMPT = `You are a senior software architect. Given a system-architecture canvas (nodes, edges) and the design conversation, write a clear, implementation-ready technical specification.

Output GitHub-flavored Markdown only — no code fences around the whole document, no preamble, no closing remarks. Structure the spec with these sections:

# <Project Title>

## Overview
A short paragraph describing the system's purpose and the high-level architecture.

## Components
For each node/component: its responsibility, key behavior, and technology notes.

## Data & Control Flow
Describe how components connect (derived from the edges) and the request/data lifecycle.

## Interfaces & Contracts
APIs, events, or messages exchanged between components.

## Non-Functional Considerations
Scalability, reliability, security, and observability notes relevant to this design.

## Open Questions
Anything ambiguous from the canvas or conversation that needs a decision.

Be concrete and grounded in the provided canvas and chat. Do not invent components that are not implied by the inputs.`;

function describeCanvas(
  nodes: GenerateSpecPayload["nodes"],
  edges: GenerateSpecPayload["edges"]
): string {
  const nodeLines = nodes.map((n) => {
    const label = n.data?.label?.trim() || "(unlabeled)";
    const shape = n.data?.shape ? ` [${n.data.shape}]` : "";
    return `- ${n.id}: ${label}${shape}`;
  });

  const idToLabel = new Map(
    nodes.map((n) => [n.id, n.data?.label?.trim() || n.id])
  );
  const edgeLines = edges.map((e) => {
    const from = e.source ? idToLabel.get(e.source) ?? e.source : "?";
    const to = e.target ? idToLabel.get(e.target) ?? e.target : "?";
    return `- ${from} → ${to}`;
  });

  return [
    `Nodes (${nodes.length}):`,
    nodeLines.length ? nodeLines.join("\n") : "(none)",
    "",
    `Edges (${edges.length}):`,
    edgeLines.length ? edgeLines.join("\n") : "(none)",
  ].join("\n");
}

function describeChat(chatHistory: GenerateSpecPayload["chatHistory"]): string {
  if (!chatHistory.length) return "(no conversation)";
  return chatHistory
    .map((m) => {
      const who = m.role || m.senderName || m.sender || "user";
      return `${who}: ${m.content}`;
    })
    .join("\n");
}

export const generateSpec = schemaTask({
  id: "generate-spec",
  schema: generateSpecSchema,
  retry: { maxAttempts: 2 },
  run: async (payload) => {
    const { projectId, roomId, chatHistory, nodes, edges } = payload;

    metadata
      .set("status", "starting")
      .set("message", "Ghost AI is preparing your spec…");

    logger.log("generate-spec started", {
      projectId,
      roomId,
      nodes: nodes.length,
      edges: edges.length,
      messages: chatHistory.length,
    });

    metadata
      .set("status", "processing")
      .set("message", "Generating technical spec with Claude…");

    const userPrompt = [
      "## Canvas",
      describeCanvas(nodes, edges),
      "",
      "## Design Conversation",
      describeChat(chatHistory),
      "",
      "Write the technical specification for this system.",
    ].join("\n");

    try {
      const [{ generateText }, { createAnthropic }] = await Promise.all([
        import("ai"),
        import("@ai-sdk/anthropic"),
      ]);
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      });

      const result = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
        maxOutputTokens: 8192,
      });

      const spec = result.text.trim();
      if (!spec) {
        throw new Error("Model returned empty spec");
      }

      metadata.set("status", "saving").set("message", "Saving spec to storage…");

      const [{ put }, { prisma }] = await Promise.all([
        import("@vercel/blob"),
        import("@/lib/prisma"),
      ]);
      const blob = await put(`specs/${projectId}/${Date.now()}.md`, spec, {
        access: "private",
        contentType: "text/markdown",
        allowOverwrite: false,
      });

      const record = await prisma.orm.public.ProjectSpec.create({
        projectId,
        filePath: blob.url,
      });

      metadata
        .set("status", "complete")
        .set("message", "Spec generated.");

      logger.log("generate-spec complete", { length: spec.length, specId: record.id });

      return { success: true as const, spec, specId: record.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("generate-spec failed", { error: msg });
      metadata
        .set("status", "error")
        .set("message", "Failed to generate spec.");
      throw err;
    }
  },
});
