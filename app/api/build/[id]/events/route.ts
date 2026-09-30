import {NextResponse, type NextRequest} from 'next/server'
import {getRecord, listEvents} from '../../../../../lib/db/knowledge-bases.ts'

export const runtime = 'nodejs'

/**
 * GET /api/build/:id/events?after=N — polling rather than WebSockets (spec §8).
 * Events are persisted, so a client that reconnects replays from seq 0.
 */
export async function GET(request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params
  const after = Number(new URL(request.url).searchParams.get('after') ?? -1)

  const [record, events] = await Promise.all([getRecord(id), listEvents(id, after)])
  if (!record) return NextResponse.json({error: 'No such build'}, {status: 404})

  return NextResponse.json({
    status: record.status,
    knowledgeBaseId: record.sanityKnowledgeBaseId,
    title: record.title,
    error: record.error,
    events: events.map((e) => ({seq: e.seq, at: e.at, event: e.event})),
  })
}
