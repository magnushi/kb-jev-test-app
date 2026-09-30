import {NextResponse} from 'next/server'
import {sanityKnowledgeBaseProvider as kbProvider} from '../../../../../lib/providers/sanity/knowledge-base.ts'

export const runtime = 'nodejs'

/**
 * GET /api/knowledge-bases/:id/outline — Sanity's real outline, plus the
 * reviewable issue count. `id` is the Sanity knowledge base public id (kb…).
 * Needs no MCP endpoint.
 */
export async function GET(_request: Request, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params
  try {
    const [outline, status] = await Promise.all([
      kbProvider.outline({knowledgeBaseId: id}),
      kbProvider.status({knowledgeBaseId: id}),
    ])
    return NextResponse.json({
      outline,
      outcome: status.state === 'review' ? 'review' : 'ready',
      openIssueCount: status.openIssueCount ?? 0,
    })
  } catch (error) {
    console.error('[api/outline]', id, error)
    return NextResponse.json({error: 'Could not read the outline.'}, {status: 502})
  }
}
