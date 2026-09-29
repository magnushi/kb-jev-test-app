import {NextResponse} from 'next/server'
import {listPublic} from '../../../lib/db/knowledge-bases.ts'

export const runtime = 'nodejs'

/** GET /api/knowledge-bases — name, purpose and maker name. Never the email. */
export async function GET() {
  return NextResponse.json({knowledgeBases: await listPublic()})
}
