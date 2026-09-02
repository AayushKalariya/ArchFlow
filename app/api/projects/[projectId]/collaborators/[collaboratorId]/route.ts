import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ projectId: string; collaboratorId: string }>;
};

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId, collaboratorId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.orm.public.ProjectCollaborator
    .where({ id: collaboratorId, projectId })
    .delete();

  return new Response(null, { status: 204 });
}
