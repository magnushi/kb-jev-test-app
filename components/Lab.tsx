'use client'

import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Header} from './shared/Header.tsx'
import {BuilderColumn, type Intent, type ProposedSource, type Thread} from './builder/BuilderColumn.tsx'
import {KnowledgeMap} from './knowledge-map/KnowledgeMap.tsx'
import {TokenStrip} from './knowledge-map/TokenStrip.tsx'
import {Legend} from './knowledge-map/Legend.tsx'
import {TestColumn, type Turn} from './test-chat/TestColumn.tsx'
import {applyEvent, emptyMapState, statusLine, type MapState} from './knowledge-map/types.ts'
import type {BuildEvent} from '../lib/db/types.ts'

const BUDGET = '3 sources · 40k candidate · 12k synthesis tokens'

export function Lab({initialCount}: {initialCount: number}) {
  const [thread, setThread] = useState<Thread[]>([
    {
      kind: 'status',
      text:
        'Describe a knowledge base and I will propose three focused public sources. ' +
        'Jev decides chunk by chunk what the synthesis model gets to see.',
    },
  ])
  const [intent, setIntent] = useState<Intent | null>(null)
  const [name, setName] = useState('')
  const [sources, setSources] = useState<ProposedSource[]>([])
  const [maker, setMaker] = useState({name: '', email: ''})
  const [busy, setBusy] = useState(false)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [map, setMap] = useState<MapState>(emptyMapState)
  const [turns, setTurns] = useState<Turn[]>([])
  const [asking, setAsking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const proposalId = useRef(0)
  const lastSeq = useRef(-1)

  const reducedMotion = useReducedMotion()

  // Maker details persist per browser, not per account (design brief §5.2).
  useEffect(() => {
    try {
      const stored = localStorage.getItem('kblab_maker')
      if (stored) setMaker(JSON.parse(stored) as {name: string; email: string})
    } catch {
      /* private mode, blocked storage */
    }
  }, [])
  useEffect(() => {
    try {
      if (maker.name || maker.email) localStorage.setItem('kblab_maker', JSON.stringify(maker))
    } catch {
      /* ignore */
    }
  }, [maker])

  // Poll persisted events. Reconnecting replays the map from seq 0.
  useEffect(() => {
    if (!buildId) return
    let cancelled = false
    const tick = async () => {
      try {
        const res = await fetch(`/api/build/${buildId}/events?after=${lastSeq.current}`)
        if (!res.ok) return
        const data = (await res.json()) as {
          status: string
          events: {seq: number; event: BuildEvent}[]
        }
        if (cancelled || data.events.length === 0) return
        setMap((current) =>
          data.events.reduce((state, item) => {
            lastSeq.current = Math.max(lastSeq.current, item.seq)
            return applyEvent(state, item.event)
          }, current),
        )
      } catch {
        /* transient; the next tick retries */
      }
    }
    void tick()
    const interval = setInterval(tick, 1200)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [buildId])

  // Announce terminal states in the builder thread.
  useEffect(() => {
    if (map.phase === 'ready') {
      setThread((t) => [...t, {kind: 'status', text: `${name} Knowledge Base is ready. Test it on the right.`}])
      if (!maker.name) {
        setThread((t) => [
          ...t,
          {
            kind: 'status',
            text: `Add your name to ${name} Knowledge Base? It shows in the list of knowledge bases.`,
          },
        ])
      }
    }
    if (map.phase === 'failed') {
      setThread((t) => [...t, {kind: 'status', text: map.error ?? 'The build failed.'}])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map.phase])

  const send = useCallback(
    async (message: string) => {
      setBusy(true)
      setNotice(null)
      setThread((t) => [...t, {kind: 'user', text: message}])
      setPending('Reading that and finding sources')
      try {
        const res = await fetch('/api/build', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({message}),
        })
        const data = (await res.json()) as {
          intent?: Intent
          sources?: ProposedSource[]
          error?: string
        }
        if (!res.ok || !data.intent) throw new Error(data.error ?? 'Could not read that request')

        setIntent(data.intent)
        setName(data.intent.title)
        setSources(data.sources ?? [])
        setThread((t) => [
          ...t.map((m) => (m.kind === 'proposal' ? {...m, locked: true} : m)),
          {kind: 'intent', intent: data.intent!, budget: BUDGET},
          {kind: 'proposal', id: ++proposalId.current, sources: data.sources ?? [], locked: false},
        ])
      } catch (error) {
        setThread((t) => [
          ...t,
          {kind: 'status', text: error instanceof Error ? error.message : 'Something went wrong.'},
        ])
      } finally {
        setPending(null)
        setBusy(false)
      }
    },
    [],
  )

  const startBuild = useCallback(async () => {
    if (!intent) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await fetch('/api/build/start', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          title: name || intent.title,
          purpose: intent.purpose,
          topic: intent.topic,
          urls: sources.map((s) => s.url),
          makerName: maker.name || undefined,
          makerEmail: maker.email || undefined,
        }),
      })
      const data = (await res.json()) as {buildId?: string; error?: string}
      if (!res.ok || !data.buildId) {
        setNotice(data.error ?? 'Could not start the build.')
        return
      }
      lastSeq.current = -1
      setMap(emptyMapState)
      setTurns([])
      setBuildId(data.buildId)
      setThread((t) => [
        ...t.map((m) => (m.kind === 'proposal' ? {...m, locked: true} : m)),
        {
          kind: 'status',
          text: `Building from ${sources.length} source${sources.length === 1 ? '' : 's'}. Jev decides chunk by chunk what the synthesis model gets to see.`,
        },
      ])
    } finally {
      setBusy(false)
    }
  }, [intent, name, sources, maker])

  const ask = useCallback(
    async (question: string) => {
      if (!map.knowledgeBaseId) return
      setAsking(true)
      setTurns((t) => [...t, {role: 'user', text: question}, {role: 'agent', text: '', streaming: true}])
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({knowledgeBaseId: map.knowledgeBaseId, question}),
        })
        const data = (await res.json()) as {
          answer?: string
          retrieved?: number
          sources?: {title: string; domain?: string}[]
          error?: string
        }
        setTurns((t) => {
          const next = [...t]
          next[next.length - 1] = {
            role: 'agent',
            text: data.answer ?? data.error ?? 'No answer.',
            retrieved: data.retrieved,
            sources: data.sources,
          }
          return next
        })
      } catch {
        setTurns((t) => {
          const next = [...t]
          next[next.length - 1] = {role: 'agent', text: 'The agent could not be reached.'}
          return next
        })
      } finally {
        setAsking(false)
      }
    },
    [map.knowledgeBaseId],
  )

  const suggestions = useMemo(
    () => map.sections.slice(0, 4).map((s) => `What does the knowledge base say about ${s.title.toLowerCase()}?`),
    [map.sections],
  )

  const displayName = name || 'New'
  const building = map.phase !== 'idle' && map.phase !== 'ready' && map.phase !== 'failed'

  return (
    <div className="page">
      <Header count={initialCount} onList="list" />
      <div className="columns">
        <BuilderColumn
          thread={thread}
          sources={sources}
          setSources={setSources}
          onSend={send}
          onBuild={startBuild}
          busy={busy}
          phase={map.phase}
          maker={maker}
          setMaker={setMaker}
          pending={pending ?? undefined}
        />

        <section className="panel" aria-label="Knowledge map">
          <div className="panel-header">
            <span className="panel-title">Knowledge map</span>
            {building ? (
              <span className="muted small">{map.buildStage ?? map.phase}</span>
            ) : (
              <button
                className="btn"
                onClick={() => {
                  setBuildId(null)
                  setMap(emptyMapState)
                  setIntent(null)
                  setName('')
                  setSources([])
                  lastSeq.current = -1
                }}
              >
                New build
              </button>
            )}
          </div>
          <div className="panel-body">
            {notice && <div className="banner">{notice}</div>}
            <h1 className="kb-name">
              <input
                className="kb-name-input"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                disabled={building || map.phase === 'ready'}
                size={Math.max(4, displayName.length)}
                aria-label="Knowledge base name"
              />
              <span>Knowledge Base</span>
              <span className="kb-status">{statusFor(map.phase)}</span>
            </h1>

            <KnowledgeMap state={map} reducedMotion={reducedMotion} />

            <div className="map-status">
              <span className="map-status-text">{statusLine(map)}</span>
              <Legend />
            </div>

            <TokenStrip state={map} />
          </div>
        </section>

        <TestColumn
          knowledgeBaseName={`${displayName} Knowledge Base`}
          knowledgeBaseId={map.knowledgeBaseId}
          ready={map.phase === 'ready' && Boolean(map.knowledgeBaseId)}
          turns={turns}
          suggestions={suggestions}
          onAsk={ask}
          busy={asking}
        />
      </div>
    </div>
  )
}

function statusFor(phase: MapState['phase']): string {
  switch (phase) {
    case 'idle':
      return 'awaiting sources'
    case 'fetching':
      return 'fetching'
    case 'filtering':
      return 'filtering'
    case 'synthesizing':
      return 'synthesizing'
    case 'creating':
      return 'creating in Sanity'
    case 'building':
      return 'building'
    case 'ready':
      return 'ready'
    case 'failed':
      return 'failed'
  }
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const listener = () => setReduced(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])
  return reduced
}
