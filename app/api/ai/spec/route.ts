import { tasks } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access";
import type { generateSpec } from "@/src/trigger/generate-spec";

const bodySchema = z.object({
  roomId: z.string().min(1),
  chatHistory: z.array(z.unknown()).default([]),
  nodes: z.array(z.unknown()).default([]),
  edges: z.array(z.unknown()).default([]),
});

export async function POST(request: NextRequest) {
  const cu = await getCurrentUser();
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { roomId, chatHistory, nodes, edges } = parsed.data;

  // Access is derived from the authenticated user + roomId only. The room id is
  // the project id (see liveblocks-auth); never trust a client-supplied projectId.
  const project = await prisma.orm.public.Project.first({ id: roomId });
  if (!project) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const hasAccess = await checkProjectAccess(project.id, project.ownerId, cu);
  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const handle = await tasks.trigger<typeof generateSpec>("generate-spec", {
    projectId: project.id,
    roomId,
    chatHistory: chatHistory as never,
    nodes: nodes as never,
    edges: edges as never,
  });

  await prisma.orm.public.TaskRun.create({
    runId: handle.id,
    projectId: project.id,
    userId: cu.userId,
  });

  return Response.json({ runId: handle.id }, { status: 201 });
}
