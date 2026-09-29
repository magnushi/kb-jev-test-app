import {NextResponse, type NextRequest} from 'next/server'
import {setMaker} from '../../../../../lib/db/knowledge-bases.ts'
import {sessionIdFrom} from '../../../../../lib/limits/index.ts'

export const runtime = 'nodejs'

/** PATCH — scoped to the creating session, so nobody can rename another build. */
export async function PATCH(request: NextRequest, context: {params: Promise<{id: string}>}) {
  const {id} = await context.params
  const {sessionId} = sessionIdFrom(request)
  const body = (await request.json()) as {makerName?: string; makerEmail?: string}

  const updated = await setMaker({
    id,
    sessionId,
    makerName: body.makerName?.trim().slice(0, 80) || undefined,
    makerEmail: body.makerEmail?.trim().slice(0, 160) || undefined,
  })
  if (!updated) return NextResponse.json({error: 'Not yours to edit.'}, {status: 403})
  return NextResponse.json({ok: true})
}
