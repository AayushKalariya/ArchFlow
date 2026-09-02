import { currentUser } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLiveblocks, getCursorColor } from "@/lib/liveblocks";
import { checkProjectAccess } from "@/lib/project-access";

export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => ({}));
  const projectId =
    body !== null && typeof body === "object" && "room" in body
      ? body.room
      : undefined;

  if (typeof projectId !== "string" || !projectId) {
    return Response.json({ error: "projectId is required" }, { status: 400 });
  }

  const project = await prisma.orm.public.Project.first({ id: projectId });
  if (!project) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const cu = {
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
  };

  const hasAccess = await checkProjectAccess(projectId, project.ownerId, cu);
  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const roomId = projectId;
  const lb = getLiveblocks();
  await lb.getOrCreateRoom(roomId, { defaultAccesses: [] });

  const name =
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.primaryEmailAddress?.emailAddress ||
    "Anonymous";

  const session = lb.prepareSession(user.id, {
    userInfo: {
      name,
      avatar: user.imageUrl,
      color: getCursorColor(user.id),
    },
  });

  session.allow(roomId, session.FULL_ACCESS);

  const { status, body: responseBody } = await session.authorize();
  return new Response(responseBody, { status });
}
