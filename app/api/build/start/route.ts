import {NextResponse, type NextRequest} from 'next/server'
import {createRecord} from '../../../../lib/db/knowledge-bases.ts'
import {assertPublicUrl} from '../../../../lib/ingestion/fetch.ts'
import {checkRateLimit, sessionIdFrom} from '../../../../lib/limits/index.ts'
import {config} from '../../../../lib/config.ts'

export const runtime = 'nodejs'
export const maxDuration = 60

/** POST /api/build/start — validate, record, and kick off the build. */
export async function POST(request: NextRequest) {
  const {sessionId, setCookie} = sessionIdFrom(request)

  const limit = await checkRateLimit(request, sessionId)
  if (!limit.ok) return NextResponse.json({error: limit.message}, {status: 429})

  try {
    const body = (await request.json()) as {
      title?: string
      purpose?: string
      topic?: string
      urls?: string[]
      makerName?: string
      makerEmail?: string
    }

    const title = body.title?.trim()
    const purpose = body.purpose?.trim()
    if (!title || !purpose) {
      return NextResponse.json({error: 'A name and purpose are required.'}, {status: 400})
    }

    // Never trust the client's limits (spec §9).
    const urls = [...new Set(body.urls ?? [])].slice(0, config.budgets.maxSources)
    if (urls.length === 0) return NextResponse.json({error: 'Keep at least one source.'}, {status: 400})
    for (const url of urls) {
      try {
        await assertPublicUrl(url)
      } catch (error) {
        return NextResponse.json(
          {error: error instanceof Error ? error.message : 'Blocked URL'},
          {status: 400},
        )
      }
    }

    const record = await createRecord({
      title: title.slice(0, 120),
      purpose: purpose.slice(0, 600),
      topic: (body.topic ?? title).slice(0, 300),
      sources: urls.map((url) => ({url})),
      sessionId,
      makerName: body.makerName?.trim().slice(0, 80) || undefined,
      makerEmail: body.makerEmail?.trim().slice(0, 160) || undefined,
    })

    // Creating the record triggers the build-knowledge-base Sanity Function.
    // Nothing is started here on purpose: a serverless function is torn down as
    // soon as it responds, so work launched from a route handler would die with it.
    if (config.runBuildsInline) {
      const {runBuild} = await import('../../../../lib/workflows/build-knowledge-base.ts')
      void runBuild(record._id).catch((error) => console.error('[build]', record._id, error))
    }

    const response = NextResponse.json({buildId: record._id})
    if (setCookie) response.cookies.set(setCookie.name, setCookie.value, setCookie.options)
    return response
  } catch (error) {
    console.error('[api/build/start]', error)
    return NextResponse.json({error: 'Could not start the build.'}, {status: 500})
  }
}
