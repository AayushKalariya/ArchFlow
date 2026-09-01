import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (project.ownerId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const rawName = body !== null && typeof body === "object" && "name" in body ? body.name : undefined;
  if (typeof rawName !== "string" || !rawName.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const updated = await prisma.orm.public.Project
    .where({ id: projectId })
    .update({ name: rawName.trim() });

  return Response.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (project.ownerId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.orm.public.Project.where({ id: projectId }).delete();

  return new Response(null, { status: 204 });
}
