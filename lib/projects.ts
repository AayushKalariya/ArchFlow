import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export interface Project {
  id: string
  name: string
  isOwner: boolean
}

export async function getOwnedProjects(): Promise<Project[]> {
  const { userId } = await auth()
  if (!userId) return []

  const rows = await prisma.orm.public.Project
    .where({ ownerId: userId })
    .orderBy((p) => p.createdAt.desc())
    .all()

  return rows.map((p) => ({ id: p.id, name: p.name, isOwner: true }))
}
