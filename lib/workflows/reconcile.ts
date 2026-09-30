import {dataset} from '../db/client.ts'
import * as db from '../db/knowledge-bases.ts'
import {KB_RECORD_TYPE, type KnowledgeBaseRecord} from '../db/types.ts'
import {sanityKnowledgeBaseProvider as kbProvider} from '../providers/sanity/knowledge-base.ts'
import {enforceRetention} from './build-knowledge-base.ts'

/** A build function can time out, or Sanity's own build can outlive it. */
const STUCK_AFTER_MS = 20 * 60 * 1000

/**
 * Moves builds out of limbo. Two cases:
 *   - waiting on Sanity's build, which can outlive the 900s function budget
 *   - abandoned mid-pipeline, because the function died
 *
 * Without this, a record can sit in `building_kb` forever and the UI waits on a
 * build nobody is driving.
 */
export async function reconcileBuilds(): Promise<{checked: number; resolved: number}> {
  const stale: KnowledgeBaseRecord[] = await dataset.fetch(
    `*[_type == $type && !(status in ["ready", "failed"])] | order(createdAt asc) [0...25]`,
    {type: KB_RECORD_TYPE},
  )

  let resolved = 0
  for (const record of stale) {
    const age = Date.now() - new Date(record.updatedAt).getTime()

    // Waiting on Sanity: ask, and finish the record if the build has landed.
    if (record.sanityKnowledgeBaseId) {
      try {
        const status = await kbProvider.status({knowledgeBaseId: record.sanityKnowledgeBaseId})
        if (!status.isBuilding && status.state !== 'building') {
          await db.patchRecord(record._id, {status: 'ready'})
          await db.appendEvent(record._id, Date.now(), {type: 'sanity.kb.ready'})
          resolved += 1
          continue
        }
        if (status.stage) {
          await db.appendEvent(record._id, Date.now(), {
            type: 'sanity.kb.building',
            stage: status.stage,
          })
        }
      } catch (error) {
        console.warn(`[reconcile] status failed for ${record._id}`, error)
      }
    }

    // No knowledge base and long since touched: the pipeline died before Stage F.
    if (!record.sanityKnowledgeBaseId && age > STUCK_AFTER_MS) {
      await db.patchRecord(record._id, {
        status: 'failed',
        error: 'The build stopped before finishing. Try again.',
      })
      await db.appendEvent(record._id, Date.now(), {
        type: 'build.failed',
        message: 'The build stopped before finishing. Try again.',
      })
      resolved += 1
    }
  }

  await enforceRetention()
  return {checked: stale.length, resolved}
}
