import { auth } from "@clerk/nextjs/server";
import { tasks, auth as triggerAuth } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { designAgent } from "@/src/trigger/design-agent";

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { prompt, roomId, projectId } = body as Record<string, unknown>;
  if (typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  if (typeof roomId !== "string" || !roomId.trim()) {
    return Response.json({ error: "roomId required" }, { status: 400 });
  }
  if (typeof projectId !== "string" || !projectId.trim()) {
    return Response.json({ error: "projectId required" }, { status: 400 });
  }

  const handle = await tasks.trigger<typeof designAgent>("design-agent", {
    prompt: prompt.trim(),
    roomId: roomId.trim(),
  });

  await prisma.orm.public.TaskRun.create({
    runId: handle.id,
    projectId: projectId.trim(),
    userId,
  });

  const publicToken = await triggerAuth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
  });

  return Response.json({ runId: handle.id, publicToken }, { status: 201 });
}
