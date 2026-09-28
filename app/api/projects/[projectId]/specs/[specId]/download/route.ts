import { get } from "@vercel/blob";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access";

type RouteContext = { params: Promise<{ projectId: string; specId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const cu = await getCurrentUser();
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectId, specId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const allowed = await checkProjectAccess(projectId, project.ownerId, cu);
  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const spec = await prisma.orm.public.ProjectSpec.first({ id: specId });
  if (!spec || spec.projectId !== projectId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await get(spec.filePath, { access: "private" });
  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const content = await new Response(result.stream).text();

  return new Response(content, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="spec-${specId}.md"`,
    },
  });
}
