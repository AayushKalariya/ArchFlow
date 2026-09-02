import { Lock } from "lucide-react"
import Link from "next/link"

export function AccessDenied() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg-base">
      <div className="flex flex-col items-center gap-4 text-center px-4">
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-bg-elevated border border-border-default">
          <Lock className="size-5 text-text-muted" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-base font-semibold text-text-primary">Access denied</h1>
          <p className="text-sm text-text-muted">
            This project does not exist or you do not have permission to view it.
          </p>
        </div>
        <Link
          href="/editor"
          className="text-sm text-accent-primary hover:underline underline-offset-4"
        >
          Back to projects
        </Link>
      </div>
    </div>
  )
}
