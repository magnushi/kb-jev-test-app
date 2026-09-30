'use client'

import {useMemo, useState} from 'react'
import type {Centrality, OutlineEntry} from '../../lib/agents/interfaces.ts'

const TIERS: {key: Centrality; heading: string}[] = [
  {key: 'core', heading: 'Core to your purpose'},
  {key: 'standard', heading: 'Supporting'},
  {key: 'peripheral', heading: 'Background'},
]

const FOLD_BACKGROUND_ABOVE = 3

/**
 * Sanity's real outline, in the DOM rather than on the canvas: it is text-heavy
 * and needs scrolling, hover, keyboard focus and screen-reader access.
 *
 * Grouped by `centrality`, because paths are usually flat at three sources.
 * Slash paths nest inside their tier; flat paths are never grouped by guesswork.
 */
export function Outline({
  entries,
  purpose,
  readPaths,
  question,
  openIssueCount,
  outcome,
}: {
  entries: OutlineEntry[]
  purpose: string
  readPaths?: string[]
  question?: string
  openIssueCount?: number
  outcome?: 'ready' | 'review'
}) {
  const [active, setActive] = useState<string | null>(null)
  const [expandedTiers, setExpandedTiers] = useState<Set<Centrality>>(new Set())

  const byPath = useMemo(() => new Map(entries.map((e) => [e.path, e])), [entries])
  const read = useMemo(() => new Set(readPaths ?? []), [readPaths])
  const anyNeighbors = entries.some((e) => e.neighbors.length > 0)

  const grouped = useMemo(
    () =>
      TIERS.map(({key, heading}) => ({
        key,
        heading,
        entries: entries.filter((e) => e.centrality === key),
      })).filter((tier) => tier.entries.length > 0),
    [entries],
  )

  return (
    <div className="outline" role="region" aria-label="Knowledge base outline">
      <div className="outline-head">
        <span className="small ink-2">
          Outline · <strong className="mono">{entries.length}</strong> entries
        </span>
      </div>

      {outcome === 'review' && openIssueCount ? (
        <p className="outline-issues">
          Sanity flagged{' '}
          <strong>
            {openIssueCount} {openIssueCount === 1 ? 'conflict' : 'conflicts'} between sources
          </strong>
          . It stays testable.
        </p>
      ) : null}

      {question ? (
        <p className="outline-question">Read by the test agent for “{question}”</p>
      ) : (
        <p className="outline-purpose">
          Core means central to your purpose: “{purpose}”
        </p>
      )}

      <div className="outline-rows">
        {grouped.map((tier) => {
          const isFoldable = tier.key === 'peripheral' && tier.entries.length > FOLD_BACKGROUND_ABOVE
          const expanded = expandedTiers.has(tier.key)
          const shown = isFoldable && !expanded ? [] : tier.entries
          const hidden = isFoldable && !expanded ? tier.entries.length : 0

          return (
            <div key={tier.key} className="tier">
              <div className="tier-head">
                {tier.heading} <span className="mono">{tier.entries.length}</span>
              </div>

              {groupByPathPrefix(shown).map(({prefix, items}) => (
                <div key={prefix ?? '_flat'}>
                  {prefix && <div className="path-head mono">{prefix}/</div>}
                  {items.map((entry) => (
                    <Row
                      key={entry.path}
                      entry={entry}
                      tier={tier.key}
                      isActive={active === entry.path}
                      wasRead={read.has(entry.path)}
                      onActivate={() => setActive(entry.path === active ? null : entry.path)}
                      byPath={byPath}
                    />
                  ))}
                </div>
              ))}

              {hidden > 0 && (
                <button
                  className="fold"
                  onClick={() => setExpandedTiers(new Set([...expandedTiers, tier.key]))}
                >
                  + {hidden} background {hidden === 1 ? 'entry' : 'entries'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="legend outline-legend">
        <span><i className="sw-keep" />core to your purpose</span>
        <span><i className="sw-border" />supporting</span>
        <span><i className="sw-drop" />background</span>
        {anyNeighbors && <span className="mono">↔ related entries</span>}
      </div>
    </div>
  )
}

function Row({
  entry,
  tier,
  isActive,
  wasRead,
  onActivate,
  byPath,
}: {
  entry: OutlineEntry
  tier: Centrality
  isActive: boolean
  wasRead: boolean
  onActivate: () => void
  byPath: Map<string, OutlineEntry>
}) {
  const showSummary = tier !== 'peripheral' || isActive

  return (
    <button
      type="button"
      className={`entry entry-${tier}${isActive ? ' entry-active' : ''}${wasRead ? ' entry-read' : ''}`}
      onClick={onActivate}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      aria-expanded={isActive}
    >
      <span className="entry-main">
        <span className="entry-top">
          <i className={`marker marker-${tier}`} aria-hidden />
          <span className="entry-title">{entry.title}</span>
        </span>
        {showSummary && entry.summary && <span className="entry-summary">{entry.summary}</span>}
        {isActive && entry.excludes && (
          <span className="entry-excludes">
            Left to other entries: {linkifyPaths(entry.excludes, byPath)}
          </span>
        )}
      </span>
      <span className="entry-meta">
        {wasRead && <span className="read-tag">read</span>}
        {entry.neighbors.length > 0 && (
          <span className="mono muted">↔ {entry.neighbors.length}</span>
        )}
      </span>
    </button>
  )
}

/**
 * `excludes` is prose, but it names other entries by path verbatim
 * ("see gates_and_circuits"). Swap exact matches against known paths for their
 * authored titles. An exact match, not parsing — an unrecognised word is left alone.
 */
function linkifyPaths(text: string, byPath: Map<string, OutlineEntry>): React.ReactNode[] {
  const paths = [...byPath.keys()].sort((a, b) => b.length - a.length)
  if (paths.length === 0) return [text]
  const pattern = new RegExp(`\\b(${paths.map(escapeRegExp).join('|')})\\b`, 'g')

  const out: React.ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index
    if (at > last) out.push(text.slice(last, at))
    out.push(
      <strong key={`${at}-${match[0]}`}>{byPath.get(match[0])!.title}</strong>,
    )
    last = at + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Flat entries first, then one group per first path segment. */
function groupByPathPrefix(
  entries: OutlineEntry[],
): {prefix: string | null; items: OutlineEntry[]}[] {
  const flat = entries.filter((e) => !e.path.includes('/'))
  const nested = new Map<string, OutlineEntry[]>()
  for (const entry of entries) {
    if (!entry.path.includes('/')) continue
    const prefix = entry.path.split('/')[0]!
    nested.set(prefix, [...(nested.get(prefix) ?? []), entry])
  }
  return [
    ...(flat.length > 0 ? [{prefix: null, items: flat}] : []),
    ...[...nested.entries()].map(([prefix, items]) => ({prefix, items})),
  ]
}
