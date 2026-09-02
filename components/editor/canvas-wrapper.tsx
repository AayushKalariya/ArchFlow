"use client"

import { Component, type ReactNode } from "react"
import { LiveblocksProvider, RoomProvider, ClientSideSuspense } from "@liveblocks/react"
import { LiveObject, LiveMap } from "@liveblocks/client"
import { Canvas } from "./canvas"

class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { error: boolean }
> {
  state = { error: false }
  static getDerivedStateFromError() {
    return { error: true }
  }
  render() {
    return this.state.error ? this.props.fallback : this.props.children
  }
}

interface CanvasWrapperProps {
  roomId: string
}

export function CanvasWrapper({ roomId }: CanvasWrapperProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex w-full h-full items-center justify-center">
          <span className="text-sm text-text-muted">Failed to connect to canvas</span>
        </div>
      }
    >
      <LiveblocksProvider authEndpoint="/api/liveblocks-auth">
        <RoomProvider
          id={roomId}
          initialPresence={{ cursor: null, isThinking: false }}
          initialStorage={() => ({
            flow: new LiveObject({
              nodes: new LiveMap(),
              edges: new LiveMap(),
            }),
          })}
        >
          <ClientSideSuspense
            fallback={
              <div className="flex w-full h-full items-center justify-center">
                <span className="text-sm text-text-muted">Connecting…</span>
              </div>
            }
          >
            <Canvas />
          </ClientSideSuspense>
        </RoomProvider>
      </LiveblocksProvider>
    </ErrorBoundary>
  )
}
