'use client'

import {useState} from 'react'

export type Turn = {
  role: 'user' | 'agent'
  text: string
  retrieved?: number
  sources?: {title: string; domain?: string}[]
  streaming?: boolean
}

export function TestColumn({
  knowledgeBaseName,
  knowledgeBaseId,
  ready,
  turns,
  suggestions,
  onAsk,
  busy,
}: {
  knowledgeBaseName: string
  knowledgeBaseId?: string
  ready: boolean
  turns: Turn[]
  suggestions: string[]
  onAsk: (question: string) => void
  busy: boolean
}) {
  const [draft, setDraft] = useState('')

  return (
    <section className="panel" aria-label="Test the knowledge base">
      <div className="panel-header">
        <span className="panel-title">Test the knowledge base</span>
      </div>

      <div className="panel-body chat-body">
        <div className="msg">
          <div className="msg-label">AGENT</div>
          {ready ? (
            <div className="ink-2">
              Grounded only in <strong>{knowledgeBaseName}</strong>
              {knowledgeBaseId ? (
                <>
                  {' ('}
                  <span className="mono small">{knowledgeBaseId}</span>
                  {')'}
                </>
              ) : null}
              . I retrieve from it through Sanity Context MCP and say so when it doesn&rsquo;t cover something.
            </div>
          ) : (
            <div className="muted">
              Waiting for a knowledge base to finish building. Testing is disabled until it&rsquo;s ready.
            </div>
          )}
        </div>

        {turns.map((turn, index) =>
          turn.role === 'user' ? (
            <div className="msg" key={index}>
              <div className="msg-label">YOU</div>
              <div className="bubble">{turn.text}</div>
            </div>
          ) : (
            <div className="msg" key={index}>
              <div className="msg-label">AGENT</div>
              {turn.retrieved !== undefined && (
                <div className="retrieval-line">
                  <i className="dot" aria-hidden />
                  Sanity Context MCP ·{' '}
                  {turn.retrieved === 0
                    ? 'no matching entries'
                    : `${turn.retrieved} ${turn.retrieved === 1 ? 'entry' : 'entries'} retrieved`}
                </div>
              )}
              <div className="answer">
                {turn.text}
                {turn.streaming && <span className="caret" aria-hidden>&nbsp;</span>}
              </div>
              {turn.sources && turn.sources.length > 0 && (
                <details className="sources">
                  <summary>
                    Sources · {turn.sources.length} KB {turn.sources.length === 1 ? 'entry' : 'entries'}
                  </summary>
                  <ul style={{margin: '6px 0 0', paddingLeft: 18}}>
                    {turn.sources.map((source, i) => (
                      <li key={i}>
                        {source.title}
                        {source.domain ? <span className="muted"> · {source.domain}</span> : null}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ),
        )}

        {ready && turns.length === 0 && suggestions.length > 0 && (
          <div className="chips">
            {suggestions.map((question) => (
              <button key={question} className="chip" onClick={() => onAsk(question)} disabled={busy}>
                {question}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="composer">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask the knowledge base"
          aria-label="Ask the knowledge base"
          disabled={!ready}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim() && ready && !busy) ask()
          }}
        />
        <button className="btn btn-primary" onClick={ask} disabled={!ready || busy || !draft.trim()}>
          Ask
        </button>
      </div>
    </section>
  )

  function ask() {
    onAsk(draft.trim())
    setDraft('')
  }
}
