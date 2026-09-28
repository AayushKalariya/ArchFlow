import { auth as clerkAuth } from "@clerk/nextjs/server";
import { auth as triggerAuth } from "@trigger.dev/sdk";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { userId } = await clerkAuth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const runId =
    body !== null && typeof body === "object" && "runId" in body
      ? (body as Record<string, unknown>).runId
      : undefined;
  if (typeof runId !== "string" || !runId.trim()) {
    return Response.json({ error: "runId required" }, { status: 400 });
  }

  const taskRun = await prisma.orm.public.TaskRun.first({ runId: runId.trim() });
  if (!taskRun) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (taskRun.userId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = await triggerAuth.createPublicToken({
    scopes: {
      read: {
        runs: [taskRun.runId],
      },
    },
  });

  return Response.json({ token });
}
