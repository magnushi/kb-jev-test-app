import {NextResponse, type NextRequest} from 'next/server'
import {interpretIntent} from '../../../lib/ingestion/intent.ts'
import {anthropicSearchProvider} from '../../../lib/providers/search/index.ts'
import {jevCandidateRanker} from '../../../lib/providers/jev/index.ts'
import {config} from '../../../lib/config.ts'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST /api/build — interpret a request into an intent plus proposed sources. */
export async function POST(request: NextRequest) {
  try {
    const {message} = (await request.json()) as {message?: string}
    if (!message || message.trim().length < 3) {
      return NextResponse.json({error: 'Describe the knowledge base you want.'}, {status: 400})
    }
    if (message.length > 2000) {
      return NextResponse.json({error: 'That request is too long.'}, {status: 400})
    }

    const intent = await interpretIntent(message)

    if (intent.userUrls.length > 0) {
      return NextResponse.json({
        intent,
        sources: intent.userUrls.slice(0, config.budgets.maxSources).map((url) => ({url})),
      })
    }

    // Spec §4 Stage B: a wide candidate set, then choose ~3. Jev does the
    // choosing, so it is load-bearing before a single page is fetched.
    const candidates = await anthropicSearchProvider.discover({
      topic: intent.topic,
      maxResults: config.budgets.maxCandidateUrls,
    })
    const {ranked, latencyMs, usage} = await jevCandidateRanker.rank({
      purpose: intent.purpose,
      topic: intent.topic,
      candidates,
    })
    const sources = (ranked.length > 0 ? ranked : candidates).slice(0, config.budgets.maxSources)

    return NextResponse.json({
      intent,
      sources,
      selection: {
        considered: candidates.length,
        chosen: sources.length,
        latencyMs,
        costUsd: usage.costUsd,
      },
    })
  } catch (error) {
    console.error('[api/build]', error)
    return NextResponse.json({error: 'Could not interpret that request.'}, {status: 500})
  }
}
