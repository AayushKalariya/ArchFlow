"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CANVAS_TEMPLATES, type CanvasTemplate } from "./starter-templates"
import type { CanvasNode } from "@/types/canvas"

const PREVIEW_W = 276
const PREVIEW_H = 144
const PREVIEW_PAD = 12

interface NodeGeom {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
}

function buildGeom(nodes: CanvasNode[], scale: number, ox: number, oy: number): Map<string, NodeGeom> {
  return new Map(
    nodes.map((node) => {
      const nw = (node.width ?? 140) * scale
      const nh = (node.height ?? 60) * scale
      const x = node.position.x * scale + ox
      const y = node.position.y * scale + oy
      return [node.id, { x, y, w: nw, h: nh, cx: x + nw / 2, cy: y + nh / 2 }]
    }),
  )
}

function computeTransform(nodes: CanvasNode[]) {
  if (nodes.length === 0) return { scale: 1, ox: PREVIEW_PAD, oy: PREVIEW_PAD }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const node of nodes) {
    const w = node.width ?? 140
    const h = node.height ?? 60
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + w)
    maxY = Math.max(maxY, node.position.y + h)
  }

  const contentW = maxX - minX || 1
  const contentH = maxY - minY || 1
  const scale = Math.min(
    (PREVIEW_W - PREVIEW_PAD * 2) / contentW,
    (PREVIEW_H - PREVIEW_PAD * 2) / contentH,
    1,
  )

  const ox = PREVIEW_PAD + ((PREVIEW_W - PREVIEW_PAD * 2) - contentW * scale) / 2 - minX * scale
  const oy = PREVIEW_PAD + ((PREVIEW_H - PREVIEW_PAD * 2) - contentH * scale) / 2 - minY * scale

  return { scale, ox, oy }
}

function nodeRx(shape: CanvasNode["data"]["shape"], w: number, h: number): number {
  if (shape === "pill" || shape === "circle") return Math.min(w, h) / 2
  if (shape === "rectangle" || shape === "cylinder") return Math.min(4, w * 0.1)
  return 0
}

function PreviewShape({ node, geom }: { node: CanvasNode; geom: NodeGeom }) {
  const { x, y, w, h } = geom
  const fill = node.data.color
  const stroke = "var(--border-subtle)"
  const sw = 0.5
  const shape = node.data.shape

  if (shape === "diamond") {
    const hw = w / 2, hh = h / 2
    const pts = `${x + hw},${y} ${x + w},${y + hh} ${x + hw},${y + h} ${x},${y + hh}`
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
  }

  if (shape === "hexagon") {
    const pts = [
      `${x + w * 0.25},${y}`,
      `${x + w * 0.75},${y}`,
      `${x + w},${y + h * 0.5}`,
      `${x + w * 0.75},${y + h}`,
      `${x + w * 0.25},${y + h}`,
      `${x},${y + h * 0.5}`,
    ].join(" ")
    return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} />
  }

  const rx = nodeRx(shape, w, h)
  return <rect x={x} y={y} width={w} height={h} rx={rx} ry={rx} fill={fill} stroke={stroke} strokeWidth={sw} />
}

function TemplatePreview({ template }: { template: CanvasTemplate }) {
  const { scale, ox, oy } = computeTransform(template.nodes)
  const geomMap = buildGeom(template.nodes, scale, ox, oy)
  const nodeMap = new Map(template.nodes.map((n) => [n.id, n]))

  return (
    <svg
      width={PREVIEW_W}
      height={PREVIEW_H}
      viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
      className="w-full h-full"
    >
      {template.edges.map((edge) => {
        const src = geomMap.get(edge.source)
        const tgt = geomMap.get(edge.target)
        if (!src || !tgt) return null
        return (
          <line
            key={edge.id}
            x1={src.cx}
            y1={src.cy}
            x2={tgt.cx}
            y2={tgt.cy}
            stroke="var(--border-default)"
            strokeWidth={0.75}
            strokeDasharray="3 2"
          />
        )
      })}
      {template.nodes.map((node) => {
        const geom = geomMap.get(node.id)
        if (!geom) return null
        const src = nodeMap.get(node.id)
        if (!src) return null
        return <PreviewShape key={node.id} node={src} geom={geom} />
      })}
    </svg>
  )
}

interface StarterTemplatesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (template: CanvasTemplate) => void
}

export function StarterTemplatesModal({ open, onOpenChange, onImport }: StarterTemplatesModalProps) {
  function handleImport(template: CanvasTemplate) {
    onImport(template)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Starter Templates</DialogTitle>
          <DialogDescription>
            Choose a template to load onto your canvas. This will replace your current work.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-[60vh] pb-1 pt-1">
          {CANVAS_TEMPLATES.map((template) => (
            <div
              key={template.id}
              className="flex flex-col rounded-xl border border-border-default bg-bg-elevated overflow-hidden"
            >
              <div
                className="bg-bg-base flex items-center justify-center"
                style={{ height: PREVIEW_H }}
              >
                <TemplatePreview template={template} />
              </div>

              <div className="flex flex-col gap-2 p-3 flex-1">
                <div>
                  <p className="text-sm font-medium text-text-primary">{template.name}</p>
                  <p className="mt-0.5 text-xs text-text-muted leading-snug">{template.description}</p>
                </div>
                <Button
                  size="sm"
                  className="w-full mt-auto"
                  onClick={() => handleImport(template)}
                >
                  Import
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
