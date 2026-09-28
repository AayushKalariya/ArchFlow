import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "project";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

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

  const slug = generateSlug(name);
  const project = await prisma.orm.public.Project.create({ ownerId: userId, name, slug });

  return Response.json(project, { status: 201 });
}
