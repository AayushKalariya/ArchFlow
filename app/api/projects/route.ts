import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.orm.public.Project
    .where({ ownerId: userId })
    .orderBy((p) => p.createdAt.desc())
    .all();

  return Response.json(projects);
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const rawName = body !== null && typeof body === "object" && "name" in body ? body.name : undefined;
  const name =
    typeof rawName === "string" && rawName.trim() ? rawName.trim() : "Untitled Project";

  const project = await prisma.orm.public.Project.create({ ownerId: userId, name });

  return Response.json(project, { status: 201 });
}
