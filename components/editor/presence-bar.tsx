"use client"

import { useOthers } from "@liveblocks/react"
import { UserButton } from "@clerk/nextjs"

const MAX_AVATARS = 5

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

function CollaboratorAvatar({
  name,
  avatar,
  color,
  index,
}: {
  name: string
  avatar?: string
  color: string
  index: number
}) {
  return (
    <div
      className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-semibold shrink-0 select-none"
      style={{
        marginLeft: index === 0 ? 0 : -8,
        zIndex: index,
        boxShadow: "0 0 0 2px #080809",
        backgroundColor: avatar ? "transparent" : color,
        color: "#fff",
      }}
      title={name}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  )
}

export function PresenceBar() {
  const others = useOthers()
  const visibleCollaborators = others.slice(0, MAX_AVATARS)
  const overflow = Math.max(0, others.length - MAX_AVATARS)

  return (
    <div className="flex items-center gap-2 bg-bg-surface/80 backdrop-blur-sm border border-border-default rounded-xl px-2 py-1">
      {others.length > 0 && (
        <>
          <div className="flex items-center">
            {visibleCollaborators.map((other, i) => (
              <CollaboratorAvatar
                key={other.connectionId}
                name={other.info?.name ?? "User"}
                avatar={other.info?.avatar}
                color={other.info?.color ?? "#808090"}
                index={i}
              />
            ))}
            {overflow > 0 && (
              <div
                className="w-8 h-8 rounded-full bg-bg-elevated border border-border-subtle flex items-center justify-center text-xs font-medium text-text-secondary shrink-0"
                style={{ marginLeft: -8, zIndex: MAX_AVATARS }}
              >
                +{overflow}
              </div>
            )}
          </div>
          <div className="w-px h-5 bg-border-default shrink-0" />
        </>
      )}
      <div className="w-8 h-8 flex items-center justify-center">
        <UserButton />
      </div>
    </div>
  )
}
