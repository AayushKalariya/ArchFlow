import { auth, currentUser } from "@clerk/nextjs/server"
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

export async function getSharedProjects(): Promise<Project[]> {
  const user = await currentUser()
  if (!user) return []

  const email = user.primaryEmailAddress?.emailAddress
  if (!email) return []

  const collabs = await prisma.orm.public.ProjectCollaborator
    .where({ email })
    .orderBy((c) => c.createdAt.desc())
    .all()

  if (collabs.length === 0) return []

  const projects = await Promise.all(
    collabs.map((c) => prisma.orm.public.Project.first({ id: c.projectId }))
  )

  return projects
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({ id: p.id, name: p.name, isOwner: false }))
}
