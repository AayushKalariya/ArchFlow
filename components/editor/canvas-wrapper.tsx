"use client"

import { Component, type ReactNode } from "react"
import { ClientSideSuspense } from "@liveblocks/react"
import { Canvas } from "./canvas"
import type { PendingTemplate } from "./starter-templates"

class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; onError: () => void },
  { error: boolean }
> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  componentDidCatch() {
    this.props.onError()
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}

interface CanvasWrapperProps {
  projectId: string
  onCanvasStateChange: (state: { ready: boolean; error: string | null }) => void
  pendingTemplate?: PendingTemplate | null
  onTemplateDone?: () => void
}

export function CanvasWrapper({ projectId, onCanvasStateChange, pendingTemplate, onTemplateDone }: CanvasWrapperProps) {
  return (
    <ErrorBoundary
      onError={() => onCanvasStateChange({ ready: false, error: "Could not connect to the live canvas. Reload the page to retry." })}
      fallback={
        <div className="flex w-full h-full items-center justify-center">
          <span className="text-sm text-text-muted">Failed to connect to canvas</span>
        </div>
      }
    >
      <ClientSideSuspense
        fallback={
          <div className="flex w-full h-full items-center justify-center">
            <span className="text-sm text-text-muted">Connecting…</span>
          </div>
        }
      >
        <Canvas projectId={projectId} onCanvasStateChange={onCanvasStateChange} pendingTemplate={pendingTemplate} onTemplateDone={onTemplateDone} />
      </ClientSideSuspense>
    </ErrorBoundary>
  )
}
