import { getOwnedProjects } from "@/lib/projects"
import { EditorHome } from "@/components/editor/editor-home"

export default async function EditorPage() {
  const ownedProjects = await getOwnedProjects()
  return <EditorHome ownedProjects={ownedProjects} sharedProjects={[]} />
}
