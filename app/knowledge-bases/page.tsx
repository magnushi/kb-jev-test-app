import Link from 'next/link'
import {Header} from '../../components/shared/Header.tsx'
import {listPublic} from '../../lib/db/knowledge-bases.ts'

export const dynamic = 'force-dynamic'

/** Name, short description, maker. Nothing else (design brief §8). */
export default async function KnowledgeBasesPage() {
  const knowledgeBases = await listPublic()

  return (
    <div className="page">
      <Header count={knowledgeBases.length} onList="lab" />
      <div className="list-wrap">
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">All knowledge bases</span>
            <span className="muted small">
              {knowledgeBases.length} knowledge base{knowledgeBases.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="panel-body">
            {knowledgeBases.length === 0 ? (
              <p className="muted">No knowledge bases yet. Build one in the Lab.</p>
            ) : (
              knowledgeBases.map((kb) => (
                <Link key={kb.id} href={`/?kb=${kb.id}`} className="kb-row">
                  <span className="grow">
                    <span className="kb-row-name">{kb.title} Knowledge Base</span>
                    <span className="kb-row-purpose" title={kb.purpose}>
                      {kb.purpose}
                    </span>
                  </span>
                  <span className="kb-row-maker">{kb.makerName || 'Anonymous'}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
