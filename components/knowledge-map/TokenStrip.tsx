import type {MapState} from './types.ts'

function compact(n: number): string {
  if (n === 0) return '—'
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`
}

/**
 * `33k source → 20.1k kept by Jev → 6k synthesized`, plus one 6px track showing
 * both as a share of source tokens. Same telemetry that drives the map.
 */
export function TokenStrip({state}: {state: MapState}) {
  const {candidateTokens: source, retainedTokens: kept, synthesizedTokens: made} = state
  const keptPct = source > 0 ? Math.min(100, (kept / source) * 100) : 0
  const madePct = source > 0 ? Math.min(100, (made / source) * 100) : 0

  return (
    <div className="token-strip">
      <div className="token-line">
        <span className="mono token-num">{compact(source)}</span>
        <span className="muted small"> source</span>
        <span className="muted token-arrow">→</span>
        <span className="mono token-num">{compact(kept)}</span>
        <span className="muted small"> kept by Jev</span>
        <span className="muted token-arrow">→</span>
        <span className="mono token-num">{compact(made)}</span>
        <span className="muted small"> synthesized</span>
        <span className="muted small token-unit">tokens</span>
      </div>
      <div className="token-track" role="img" aria-label={`${kept} of ${source} tokens kept, ${made} synthesized`}>
        <div className="token-kept" style={{width: `${keptPct}%`}} />
        <div className="token-made" style={{width: `${madePct}%`}} />
      </div>
    </div>
  )
}
