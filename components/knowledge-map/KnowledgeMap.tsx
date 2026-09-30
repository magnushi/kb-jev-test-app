'use client'

import {useEffect, useMemo, useRef, useState} from 'react'
import type {ChunkNode, MapState} from './types.ts'

const SQUARE = 12
const SQUARE_FOCUS = 16
const GAP = 4
const LANE_HEADER = 28
const ROW_HEIGHT = 108

type Tip = {x: number; y: number; lines: string[]} | null

/**
 * Three labeled lanes: sources on the left, the Jev divider at 50%, and the
 * knowledge base on the right. One 12px square per real chunk, coloured by the
 * actual decision. Aggregates when there are more chunks than fit, rather than
 * drawing off the edge (design brief §6.1).
 */
export function KnowledgeMap({state, reducedMotion}: {state: MapState; reducedMotion: boolean}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tip, setTip] = useState<Tip>(null)
  const [hoveredSection, setHoveredSection] = useState<number | null>(null)
  const hitBoxes = useRef<{x: number; y: number; w: number; h: number; chunk: ChunkNode}[]>([])

  // Three slots always, so the lane never reflows as sources arrive.
  const slots = useMemo(() => {
    const filled = state.sources.slice(0, 3)
    return [...filled, ...Array.from({length: 3 - filled.length}, () => null)]
  }, [state.sources])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const draw = () => {
      const styles = getComputedStyle(document.documentElement)
      const token = (name: string) => styles.getPropertyValue(name).trim()
      const dpr = window.devicePixelRatio || 1
      const width = parent.clientWidth
      const height = parent.clientHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      const colors = {
        ink: token('--ink'),
        ink2: token('--ink-2'),
        muted: token('--muted'),
        line: token('--line'),
        line2: token('--line-2'),
        accent: token('--accent'),
        accentSoft: token('--accent-soft'),
        surface: token('--surface'),
        surface2: token('--surface-2'),
      }

      const laneWidth = width * 0.44
      const dividerX = width * 0.5
      hitBoxes.current = []

      // ---- Lane headers ----
      const active = state.phase
      ctx.font = `600 12px ${token('--sans')}`
      const headers: [string, number, boolean][] = [
        ['1 Sources', 0, active === 'fetching'],
        ['2 Jev', dividerX - 26, active === 'filtering'],
        [
          '3 Knowledge Base',
          width - 108,
          active === 'synthesizing' || active === 'creating' || active === 'building' || active === 'ready',
        ],
      ]
      for (const [text, x, isActive] of headers) {
        ctx.fillStyle = isActive ? colors.accent : colors.muted
        ctx.fillText(text, x, 14)
      }
      ctx.strokeStyle = colors.line
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, LANE_HEADER - 6.5)
      ctx.lineTo(width, LANE_HEADER - 6.5)
      ctx.stroke()

      // ---- Lane 2: the Jev divider ----
      ctx.strokeStyle = active === 'filtering' ? colors.accent : colors.line2
      ctx.setLineDash([3, 4])
      ctx.beginPath()
      ctx.moveTo(dividerX, LANE_HEADER)
      ctx.lineTo(dividerX, height - 4)
      ctx.stroke()
      ctx.setLineDash([])

      // ---- Lane 1: sources ----
      slots.forEach((source, index) => {
        const top = LANE_HEADER + 8 + index * ROW_HEIGHT

        if (!source) {
          ctx.strokeStyle = colors.line
          ctx.setLineDash([3, 3])
          ctx.strokeRect(0.5, top + 0.5, laneWidth - 8, 44)
          ctx.setLineDash([])
          ctx.fillStyle = colors.muted
          ctx.font = `400 12px ${token('--sans')}`
          ctx.fillText('Open source slot', 10, top + 26)
          return
        }

        const chunks = source.chunkIds.flatMap((id) => state.chunks[id] ?? [])
        const decided = chunks.filter((c) => c.state !== 'undecided')
        const kept = chunks.filter((c) => c.state === 'keep' || c.state === 'borderline').length

        ctx.fillStyle = colors.ink
        ctx.font = `500 12px ${token('--sans')}`
        ctx.fillText(truncate(ctx, source.host, laneWidth - 92), 0, top + 12)

        ctx.fillStyle = colors.muted
        ctx.font = `400 11px ${token('--mono')}`
        const tally = source.failed
          ? 'failed'
          : decided.length === chunks.length && chunks.length > 0
            ? `${kept} of ${chunks.length} kept`
            : chunks.length > 0
              ? `${chunks.length} chunks`
              : '…'
        const tallyWidth = ctx.measureText(tally).width
        ctx.fillText(tally, laneWidth - 8 - tallyWidth, top + 12)

        // One square per chunk, wrapping; aggregate if they would overflow.
        const perRow = Math.max(1, Math.floor((laneWidth - 8) / (SQUARE + GAP)))
        const maxRows = 4
        const capacity = perRow * maxRows
        const drawn = chunks.slice(0, capacity)

        drawn.forEach((chunk, i) => {
          const x = (i % perRow) * (SQUARE + GAP)
          const y = top + 22 + Math.floor(i / perRow) * (SQUARE + GAP)
          const focused = state.evaluating === chunk.id && !reducedMotion
          const size = focused ? SQUARE_FOCUS : SQUARE
          const offset = focused ? -(SQUARE_FOCUS - SQUARE) / 2 : 0

          ctx.beginPath()
          switch (chunk.state) {
            case 'keep':
              ctx.fillStyle = colors.accent
              ctx.fillRect(x + offset, y + offset, size, size)
              break
            case 'borderline':
              ctx.fillStyle = colors.accentSoft
              ctx.fillRect(x + offset, y + offset, size, size)
              ctx.strokeStyle = colors.accent
              ctx.strokeRect(x + offset + 0.5, y + offset + 0.5, size - 1, size - 1)
              break
            case 'drop':
              ctx.fillStyle = colors.surface2
              ctx.fillRect(x, y, SQUARE, SQUARE)
              ctx.strokeStyle = colors.line
              ctx.strokeRect(x + 0.5, y + 0.5, SQUARE - 1, SQUARE - 1)
              ctx.strokeStyle = colors.line2
              ctx.beginPath()
              ctx.moveTo(x + 2, y + SQUARE - 2)
              ctx.lineTo(x + SQUARE - 2, y + 2)
              ctx.stroke()
              break
            default:
              ctx.fillStyle = colors.surface
              ctx.fillRect(x, y, SQUARE, SQUARE)
              ctx.strokeStyle = colors.line2
              ctx.strokeRect(x + 0.5, y + 0.5, SQUARE - 1, SQUARE - 1)
          }
          if (focused) {
            ctx.strokeStyle = colors.ink
            ctx.lineWidth = 1.5
            ctx.strokeRect(x + offset + 0.5, y + offset + 0.5, size - 1, size - 1)
            ctx.lineWidth = 1
          }
          hitBoxes.current.push({x, y, w: SQUARE, h: SQUARE, chunk})
        })

        if (chunks.length > capacity) {
          ctx.fillStyle = colors.muted
          ctx.font = `400 11px ${token('--mono')}`
          ctx.fillText(`+${chunks.length - capacity} more`, 0, top + 22 + maxRows * (SQUARE + GAP) + 10)
        }
      })

      // ---- Lane 3: the knowledge base ----
      const rightX = dividerX + 16
      const rightWidth = width - rightX
      if (state.sections.length === 0) {
        ctx.fillStyle = colors.muted
        ctx.font = `400 12px ${token('--sans')}`
        ctx.fillText('Sections appear here after Jev and synthesis run.', rightX, LANE_HEADER + 20)
        ctx.fillText('Kept chunks are synthesized into sections next.', rightX, LANE_HEADER + 38)
      } else {
        state.sections.slice(0, 12).forEach((section, index) => {
          const y = LANE_HEADER + 24 + index * 20
          if (section.retrieved) {
            ctx.fillStyle = colors.accentSoft
            ctx.fillRect(rightX - 6, y - 11, rightWidth, 18)
          }
          ctx.fillStyle = colors.accent
          ctx.fillRect(rightX, y - 7, 8, 8)
          ctx.fillStyle = hoveredSection === index ? colors.ink : colors.ink2
          ctx.font = `500 12px ${token('--sans')}`
          // No per-section chunk count: we have no real provenance for it.
          ctx.fillText(truncate(ctx, section.title, rightWidth - 16), rightX + 14, y)
        })

        const footerY = LANE_HEADER + 24 + Math.min(state.sections.length, 12) * 20 + 10
        ctx.strokeStyle = colors.line
        ctx.beginPath()
        ctx.moveTo(rightX, footerY)
        ctx.lineTo(width, footerY)
        ctx.stroke()
        ctx.fillStyle = colors.ink2
        ctx.font = `400 11px ${token('--mono')}`
        const kbLine = state.knowledgeBaseId
          ? `Sanity KB ${state.knowledgeBaseId} · ${state.buildStage ?? state.phase}`
          : 'Sanity KB · creating…'
        ctx.fillText(truncate(ctx, kbLine, rightWidth), rightX, footerY + 16)
      }
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(parent)
    const scheme = window.matchMedia('(prefers-color-scheme: dark)')
    scheme.addEventListener('change', draw)
    return () => {
      observer.disconnect()
      scheme.removeEventListener('change', draw)
    }
  }, [state, slots, reducedMotion, hoveredSection])

  return (
    <div className="map-area">
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const x = e.clientX - rect.left
          const y = e.clientY - rect.top
          const hit = hitBoxes.current.find(
            (b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h,
          )
          if (!hit) return setTip(null)
          const verdict =
            hit.chunk.state === 'keep'
              ? 'KEEP'
              : hit.chunk.state === 'borderline'
                ? 'BORDERLINE · KEPT'
                : hit.chunk.state === 'drop'
                  ? 'DROP'
                  : 'evaluating'
          setTip({
            x,
            y,
            lines: [
              hit.chunk.label,
              hit.chunk.score !== undefined
                ? `P(yes) ${hit.chunk.score.toFixed(2)} · ${verdict}`
                : verdict,
            ],
          })
        }}
        onMouseLeave={() => setTip(null)}
      />
      {tip && (
        <div className="map-tip" style={{left: tip.x + 12, top: tip.y + 12}}>
          {tip.lines.map((line, i) => (
            <div key={i} className={i === 1 ? 'mono xs muted' : 'xs'}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let result = text
  while (result.length > 1 && ctx.measureText(`${result}…`).width > max) {
    result = result.slice(0, -1)
  }
  return `${result}…`
}
