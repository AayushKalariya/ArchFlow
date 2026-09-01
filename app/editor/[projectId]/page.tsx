import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"

interface WorkspacePageProps {
  params: Promise<{ projectId: string }>
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params
  const { userId } = await auth()
  if (!userId) return null

  const project = await prisma.orm.public.Project
    .where({ id: projectId })
    .first()

  if (!project) notFound()

  return (
    <div className="flex flex-col h-screen bg-bg-canvas">
      <header className="fixed top-0 inset-x-0 z-40 h-12 flex items-center px-4 bg-bg-surface border-b border-border-default">
        <span className="text-sm font-medium text-text-primary">{project.name}</span>
      </header>
      <main className="flex flex-1 items-center justify-center mt-12 text-text-muted text-sm">
        Canvas coming soon
      </main>
    </div>
  )
}
