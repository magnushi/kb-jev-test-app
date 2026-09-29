import crypto from 'node:crypto'
import type {NextRequest} from 'next/server'
import {dataset} from '../db/client.ts'
import {KB_RECORD_TYPE} from '../db/types.ts'
import {config} from '../config.ts'

const COOKIE = 'kblab_session'

/** Anonymous session, cookie-bound. No accounts (spec §9). */
export function sessionIdFrom(request: NextRequest): {
  sessionId: string
  setCookie?: {name: string; value: string; options: {httpOnly: boolean; sameSite: 'lax'; path: string; maxAge: number}}
} {
  const existing = request.cookies.get(COOKIE)?.value
  if (existing) return {sessionId: existing}
  const sessionId = crypto.randomUUID()
  return {
    sessionId,
    setCookie: {
      name: COOKIE,
      value: sessionId,
      options: {httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365},
    },
  }
}

/**
 * Two gates, both server-side:
 *   - a global burst gate, which shows the "heavy load" message
 *   - one concurrent build per session
 * Counted from the records themselves, so it survives a restart.
 */
export async function checkRateLimit(
  _request: NextRequest,
  sessionId: string,
): Promise<{ok: true} | {ok: false; message: string}> {
  const since = new Date(Date.now() - config.limits.burstWindowMs).toISOString()

  const [recent, mine] = await Promise.all([
    dataset.fetch<number>(`count(*[_type == $type && createdAt > $since])`, {
      type: KB_RECORD_TYPE,
      since,
    }),
    dataset.fetch<number>(
      `count(*[_type == $type && sessionId == $sessionId && !(status in ["ready", "failed"])])`,
      {type: KB_RECORD_TYPE, sessionId},
    ),
  ])

  if (recent >= config.limits.burstMaxBuilds) {
    return {ok: false, message: 'Sorry, we are experiencing heavy load now. Try again in a few minutes.'}
  }
  if (mine >= config.limits.maxConcurrentPerSession) {
    return {ok: false, message: 'You already have a build running. Wait for it to finish.'}
  }
  return {ok: true}
}
