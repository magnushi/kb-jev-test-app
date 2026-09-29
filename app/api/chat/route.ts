import {NextResponse, type NextRequest} from 'next/server'
import {askKnowledgeBase} from '../../../lib/agents/test-agent.ts'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const {knowledgeBaseId, question} = (await request.json()) as {
      knowledgeBaseId?: string
      question?: string
    }
    if (!knowledgeBaseId || !question?.trim()) {
      return NextResponse.json({error: 'A knowledge base and a question are required.'}, {status: 400})
    }
    if (question.length > 1000) {
      return NextResponse.json({error: 'That question is too long.'}, {status: 400})
    }

    const result = await askKnowledgeBase({knowledgeBaseId, question: question.trim()})
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api/chat]', error)
    return NextResponse.json(
      {error: error instanceof Error ? error.message : 'The agent failed.'},
      {status: 500},
    )
  }
}
