'use client'

import {useEffect, useRef, useState} from 'react'

export type ProposedSource = {url: string; title?: string}
export type Intent = {title: string; purpose: string; topic: string}

export type Thread =
  | {kind: 'user'; text: string}
  | {kind: 'intent'; intent: Intent; budget: string}
  | {kind: 'proposal'; id: number; sources: ProposedSource[]; locked: boolean}
  | {kind: 'status'; text: string}

const MAX_SOURCES = 3

export function BuilderColumn({
  thread,
  sources,
  setSources,
  onSend,
  onBuild,
  busy,
  phase,
  maker,
  setMaker,
  pending,
}: {
  thread: Thread[]
  sources: ProposedSource[]
  setSources: (next: ProposedSource[]) => void
  onSend: (message: string) => void
  onBuild: () => void
  busy: boolean
  phase: string
  maker: {name: string; email: string}
  setMaker: (next: {name: string; email: string}) => void
  /** Shown while the builder is interpreting a request, which can take a minute. */
  pending?: string
}) {
  const [draft, setDraft] = useState('')
  const [urlDraft, setUrlDraft] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const [showEmail, setShowEmail] = useState(false)
  const [editingMaker, setEditingMaker] = useState(false)

  const atLimit = sources.length >= MAX_SOURCES
  const building = phase !== 'idle' && phase !== 'ready' && phase !== 'failed'
  const hasProposal = thread.some((m) => m.kind === 'proposal' && !m.locked)
  const savedMaker = maker.name.trim().length > 0 && !editingMaker

  // Keep the newest message in view. Without this, appended messages land below
  // the fold and the opening prompt stays on screen, which reads as a repeat ask.
  useEffect(() => {
    const body = bodyRef.current
    if (body) body.scrollTop = body.scrollHeight
  }, [thread, pending])

  return (
    <section className="panel" aria-label="Build">
      <div className="panel-header">
        <span className="panel-title">Build</span>
      </div>

      <div className="panel-body chat-body" ref={bodyRef}>
        {thread.map((message, index) => {
          if (message.kind === 'user') {
            return (
              <div className="msg" key={index}>
                <div className="msg-label">YOU</div>
                <div className="bubble">{message.text}</div>
              </div>
            )
          }
          if (message.kind === 'status') {
            return (
              <div className="msg" key={index}>
                <div className="msg-label">BUILDER</div>
                <div className="ink-2">{message.text}</div>
              </div>
            )
          }
          if (message.kind === 'intent') {
            return (
              <div className="msg" key={index}>
                <div className="msg-label">BUILDER</div>
                <div className="ink-2" style={{marginBottom: 8}}>
                  Here&rsquo;s how I read that:
                </div>
                <div className="intent-card">
                  <div className="intent-row">
                    <span className="intent-key">name</span>
                    <span>{message.intent.title} Knowledge Base</span>
                  </div>
                  <div className="intent-row">
                    <span className="intent-key">purpose</span>
                    <span>{message.intent.purpose}</span>
                  </div>
                  <div className="intent-row">
                    <span className="intent-key">budget</span>
                    <span>{message.budget}</span>
                  </div>
                </div>
              </div>
            )
          }

          const live = !message.locked
          const shown = live ? sources : message.sources
          return (
            <div className="msg" key={index}>
              <div className="msg-label">BUILDER</div>
              <div className="ink-2" style={{marginBottom: 8}}>
                I found these {shown.length === 1 ? 'sources' : `${numberWord(shown.length)} sources`}. Build from
                these?
              </div>

              {shown.map((source) => (
                <div className="source-card" key={source.url}>
                  <span className="grow">
                    <span className="source-host">{hostOf(source.url)}</span>
                    <br />
                    <span className="source-title">{source.title ?? source.url}</span>
                  </span>
                  {live && (
                    <button
                      className="remove"
                      aria-label={`Remove ${hostOf(source.url)}`}
                      onClick={() =>
                        sources.length > 1
                          ? setSources(sources.filter((s) => s.url !== source.url))
                          : undefined
                      }
                      disabled={sources.length <= 1}
                      title={sources.length <= 1 ? 'Keep at least one source' : 'Remove'}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              {live && (
                <>
                  <div className="add-row">
                    <input
                      value={urlDraft}
                      onChange={(e) => setUrlDraft(e.target.value)}
                      disabled={atLimit || building}
                      placeholder={
                        atLimit
                          ? `${MAX_SOURCES} of ${MAX_SOURCES} sources. Remove one to add another.`
                          : `https://… add a URL (${sources.length} of ${MAX_SOURCES})`
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') addUrl()
                      }}
                    />
                    <button className="btn" onClick={addUrl} disabled={atLimit || building || !urlDraft.trim()}>
                      Add
                    </button>
                  </div>

                  <button className="btn btn-primary" onClick={onBuild} disabled={busy || building || sources.length === 0}>
                    Build from {sources.length} source{sources.length === 1 ? '' : 's'}
                  </button>

                  <div className="built-by">
                    {savedMaker ? (
                      <>
                        <span>
                          Built by {maker.name}
                          {maker.email ? ` · ${maker.email.split('@')[0]}@…` : ''}
                        </span>
                        <button className="link-btn" onClick={() => setEditingMaker(true)}>
                          Edit
                        </button>
                      </>
                    ) : (
                      <>
                        <span>Built by</span>
                        <input
                          value={maker.name}
                          onChange={(e) => setMaker({...maker, name: e.target.value})}
                          placeholder="Your name (optional)"
                        />
                        {showEmail ? (
                          <input
                            value={maker.email}
                            onChange={(e) => setMaker({...maker, email: e.target.value})}
                            placeholder="Email (not shown publicly)"
                            type="email"
                          />
                        ) : (
                          <button className="link-btn" onClick={() => setShowEmail(true)}>
                            Add email
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
        {pending && (
          <div className="msg">
            <div className="msg-label">BUILDER</div>
            <div className="muted pending">
              {pending}
              <span className="ellipsis" aria-hidden>
                <i /><i /><i />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Describe a knowledge base, or paste URLs"
          aria-label="Describe a knowledge base, or paste URLs"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim() && !busy) send()
          }}
        />
        <button className="btn" onClick={send} disabled={busy || !draft.trim()}>
          Send
        </button>
      </div>
    </section>
  )

  function send() {
    onSend(draft.trim())
    setDraft('')
  }

  function addUrl() {
    const url = urlDraft.trim()
    if (!url || atLimit) return
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    if (sources.some((s) => s.url === normalized)) return setUrlDraft('')
    setSources([...sources, {url: normalized}])
    setUrlDraft('')
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function numberWord(n: number): string {
  return ['zero', 'one', 'two', 'three'][n] ?? String(n)
}
