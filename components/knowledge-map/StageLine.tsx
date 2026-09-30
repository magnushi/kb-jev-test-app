'use client'

export const BUILD_STAGES = [
  'tldr',
  'map',
  'triage',
  'plan',
  'organize',
  'arrange',
  'write',
  'review',
  'polish',
] as const

export type BuildStageId = (typeof BUILD_STAGES)[number]

/** Our reading of Sanity's stage names. Unconfirmed by the Context team. */
export const STAGE_CAPTIONS: Record<BuildStageId | 'queued', string> = {
  queued: 'Waiting for a build slot at Sanity',
  tldr: 'Summarizing the material',
  map: 'Reading through the material',
  triage: 'Grouping related material',
  plan: 'Planning the topic tree',
  organize: 'Organizing topics',
  arrange: 'Arranging entries in the tree',
  write: 'Writing entries',
  review: 'Checking entries against the sources',
  polish: 'Final pass',
}

/**
 * All nine stages plus queued, shown at once. The horizon is the point: one word
 * says nothing, nine with six struck through says everything. No percentages —
 * stage durations are very uneven, so a bar would stall and lie.
 */
export function StageLine({
  current,
  done,
  failedAt,
  reducedMotion,
}: {
  current?: BuildStageId | 'queued'
  done: Set<string>
  failedAt?: BuildStageId | 'queued'
  reducedMotion: boolean
}) {
  const all: (BuildStageId | 'queued')[] = ['queued', ...BUILD_STAGES]

  return (
    <div className="stage-line" aria-label="Build stages">
      {all.map((stage) => {
        const isFailed = failedAt === stage
        const isCurrent = !failedAt && stage === current
        const isDone = done.has(stage) && !isCurrent && !isFailed
        return (
          <span
            key={stage}
            className={`stage${isDone ? ' stage-done' : ''}${isCurrent ? ' stage-current' : ''}${isFailed ? ' stage-failed' : ''}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            {isCurrent && (
              <i className={`stage-dot${reducedMotion ? '' : ' stage-dot-pulse'}`} aria-hidden />
            )}
            {stage}
            {isFailed && <span className="stage-stopped"> · stopped</span>}
          </span>
        )
      })}
    </div>
  )
}

export function elapsed(fromMs: number, nowMs: number): string {
  const total = Math.max(0, Math.floor((nowMs - fromMs) / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
