import { put, get } from "@vercel/blob"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access"
import { getLiveblocks } from "@/lib/liveblocks"
import { readDesignGraph } from "@/src/trigger/design-graph"

type RouteContext = { params: Promise<{ projectId: string }> }

export async function PUT(_request: NextRequest, { params }: RouteContext) {
  const cu = await getCurrentUser()
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params

  const project = await prisma.orm.public.Project.first({ id: projectId })
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const allowed = await checkProjectAccess(projectId, project.ownerId, cu)
  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  // Read the live room for every save. Client requests may arrive out of order.
  const liveblocks = getLiveblocks()
  for (let attempt = 0; attempt < 3; attempt++) {
    const currentProject = await prisma.orm.public.Project.first({ id: projectId })
    if (!currentProject) return Response.json({ error: "Not found" }, { status: 404 })
    const graph = readDesignGraph(await liveblocks.getStorageDocument(projectId, "json"))
    const blob = await put(`canvas/${projectId}/${crypto.randomUUID()}.json`, JSON.stringify(graph), {
      access: "private",
      contentType: "application/json",
    })
    const latest = readDesignGraph(await liveblocks.getStorageDocument(projectId, "json"))
    if (JSON.stringify(latest) !== JSON.stringify(graph)) continue
    const updated = await prisma.orm.public.Project.where({ id: projectId, canvasJsonPath: currentProject.canvasJsonPath }).update({
      canvasJsonPath: blob.url,
    })
    if (updated) return Response.json({ url: blob.url })
  }
  return Response.json({ error: "Canvas changed during save. It will be retried on the next edit." }, { status: 409 })
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const cu = await getCurrentUser()
  if (!cu) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params

  const project = await prisma.orm.public.Project.first({ id: projectId })
  if (!project) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const allowed = await checkProjectAccess(projectId, project.ownerId, cu)
  if (!allowed) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!project.canvasJsonPath) {
    return Response.json({ canvas: null })
  }

  const result = await get(project.canvasJsonPath, { access: "private" })
  if (!result) {
    return Response.json({ error: "Saved canvas is unavailable" }, { status: 503 })
  }

  const canvas = await new Response(result.stream).json()
  return Response.json({ canvas })
}
