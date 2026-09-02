import { currentUser } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

export interface CurrentUser {
  userId: string
  email: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const user = await currentUser()
  if (!user) return null
  return {
    userId: user.id,
    email: user.primaryEmailAddress?.emailAddress ?? null,
  }
}

export async function checkProjectAccess(
  projectId: string,
  ownerId: string,
  cu: CurrentUser
): Promise<boolean> {
  if (cu.userId === ownerId) return true
  if (cu.email) {
    const collab = await prisma.orm.public.ProjectCollaborator
      .where({ projectId, email: cu.email })
      .first()
    return !!collab
  }
  return false
}
