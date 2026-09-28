import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const cu = await getCurrentUser();
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await checkProjectAccess(projectId, project.ownerId, cu);
  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const specs = await prisma.orm.public.ProjectSpec
    .where({ projectId })
    .orderBy((s) => s.createdAt.desc())
    .all();

  return Response.json(specs);
}
