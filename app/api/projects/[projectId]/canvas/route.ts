import { put, get } from "@vercel/blob"
import type { NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access"

type RouteContext = { params: Promise<{ projectId: string }> }

export async function PUT(request: NextRequest, { params }: RouteContext) {
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

  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid body" }, { status: 400 })
  }

  const json = JSON.stringify(body)
  const blob = await put(`canvas/${projectId}.json`, json, {
    access: "private",
    contentType: "application/json",
    allowOverwrite: true,
  })

  await prisma.orm.public.Project.where({ id: projectId }).update({
    canvasJsonPath: blob.url,
  })

  return Response.json({ url: blob.url })
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
    return Response.json({ canvas: null })
  }

  const canvas = await new Response(result.stream).json()
  return Response.json({ canvas })
}
