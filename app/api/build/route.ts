import {NextResponse, type NextRequest} from 'next/server'
import {interpretIntent} from '../../../lib/ingestion/intent.ts'
import {anthropicSearchProvider} from '../../../lib/providers/search/index.ts'
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
    const sources =
      intent.userUrls.length > 0
        ? intent.userUrls.map((url) => ({url}))
        : await anthropicSearchProvider.discover({
            topic: intent.topic,
            maxResults: config.budgets.maxSources,
          })

    return NextResponse.json({intent, sources: sources.slice(0, config.budgets.maxSources)})
  } catch (error) {
    console.error('[api/build]', error)
    return NextResponse.json({error: 'Could not interpret that request.'}, {status: 500})
  }
}
