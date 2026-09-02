import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });

  const isOwner = project.ownerId === user.id;
  if (!isOwner) {
    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return Response.json({ error: "Forbidden" }, { status: 403 });
    const collab = await prisma.orm.public.ProjectCollaborator
      .where({ projectId, email })
      .first();
    if (!collab) return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const collabs = await prisma.orm.public.ProjectCollaborator
    .where({ projectId })
    .orderBy((c) => c.createdAt.asc())
    .all();

  if (collabs.length === 0) return Response.json([]);

  const emails = collabs.map((c) => c.email);
  const clerk = await clerkClient();
  const BATCH = 100;
  const allClerkUsers = [];
  for (let i = 0; i < emails.length; i += BATCH) {
    const { data } = await clerk.users.getUserList({
      emailAddress: emails.slice(i, i + BATCH),
      limit: BATCH,
    });
    allClerkUsers.push(...data);
  }

  const userMap = new Map<string, (typeof allClerkUsers)[number]>();
  for (const u of allClerkUsers) {
    for (const ea of u.emailAddresses) {
      userMap.set(ea.emailAddress, u);
    }
  }

  const result = collabs.map((c) => {
    const cu = userMap.get(c.email);
    const displayName = cu
      ? `${cu.firstName ?? ""} ${cu.lastName ?? ""}`.trim() || null
      : null;
    return {
      id: c.id,
      email: c.email,
      displayName,
      imageUrl: cu?.imageUrl ?? null,
    };
  });

  return Response.json(result);
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) return Response.json({ error: "Not found" }, { status: 404 });
  if (project.ownerId !== userId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const rawEmail =
    body !== null && typeof body === "object" && "email" in body
      ? body.email
      : undefined;
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : null;
  if (!email) {
    return Response.json({ error: "email is required" }, { status: 400 });
  }

  const existing = await prisma.orm.public.ProjectCollaborator
    .where({ projectId, email })
    .first();
  if (existing) {
    return Response.json({ error: "Already a collaborator" }, { status: 409 });
  }

  const collab = await prisma.orm.public.ProjectCollaborator.create({
    projectId,
    email,
  });

  return Response.json(collab, { status: 201 });
}
