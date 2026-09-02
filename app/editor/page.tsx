import { getOwnedProjects, getSharedProjects } from "@/lib/projects"
import { EditorHome } from "@/components/editor/editor-home"

export default async function EditorPage() {
  const [ownedProjects, sharedProjects] = await Promise.all([
    getOwnedProjects(),
    getSharedProjects(),
  ])
  return <EditorHome ownedProjects={ownedProjects} sharedProjects={sharedProjects} />
}
