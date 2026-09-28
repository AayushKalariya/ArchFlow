import { auth as triggerAuth } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/project-access";

const bodySchema = z.object({ runId: z.string().min(1) });

export async function POST(request: NextRequest) {
  const cu = await getCurrentUser();
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  const taskRun = await prisma.orm.public.TaskRun.first({
    runId: parsed.data.runId,
  });
  if (!taskRun) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (taskRun.userId !== cu.userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = await triggerAuth.createPublicToken({
    scopes: { read: { runs: [taskRun.runId] } },
    expirationTime: "1h",
  });

  return Response.json({ token });
}
