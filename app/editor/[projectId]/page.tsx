import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, checkProjectAccess } from "@/lib/project-access"
import { getOwnedProjects, getSharedProjects } from "@/lib/projects"
import { AccessDenied } from "@/components/editor/access-denied"
import { WorkspaceShell } from "@/components/editor/workspace-shell"

interface WorkspacePageProps {
  params: Promise<{ projectId: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params

  const cu = await getCurrentUser()
  if (!cu) redirect("/sign-in")

  const project = await prisma.orm.public.Project.first({ id: projectId })
  if (!project) return <AccessDenied />

  const hasAccess = await checkProjectAccess(projectId, project.ownerId, cu)
  if (!hasAccess) return <AccessDenied />

  const [ownedProjects, sharedProjects] = await Promise.all([
    getOwnedProjects(),
    getSharedProjects(),
  ])

  return (
    <WorkspaceShell
      project={{ id: project.id, name: project.name }}
      isOwner={cu.userId === project.ownerId}
      ownedProjects={ownedProjects}
      sharedProjects={sharedProjects}
    />
  )
}
