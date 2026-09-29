import { tasks, auth as triggerAuth } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access";
import type { designAgent } from "@/src/trigger/design-agent";

const bodySchema = z.strictObject({
  prompt: z.string().trim().min(1).max(2000),
  projectId: z.string().trim().min(1).max(128),
  roomId: z.string().trim().min(1).max(128).optional(),
});

export async function POST(request: NextRequest) {
  const cu = await getCurrentUser();
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const { prompt, projectId, roomId } = parsed.data;
  if (roomId !== undefined && roomId !== projectId) {
    return Response.json({ error: "Room and project do not match" }, { status: 400 });
  }
  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await checkProjectAccess(project.id, project.ownerId, cu))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const handle = await tasks.trigger<typeof designAgent>("design-agent", {
    prompt,
    roomId: project.id,
  }, { concurrencyKey: project.id });

  await prisma.orm.public.TaskRun.create({
    runId: handle.id,
    projectId: project.id,
    userId: cu.userId,
  });

  const publicToken = await triggerAuth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
  });

  return Response.json({ runId: handle.id, publicToken }, { status: 201 });
}
