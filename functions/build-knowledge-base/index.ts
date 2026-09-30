import {documentEventHandler} from '@sanity/functions'
import {runBuild} from '../../lib/workflows/build-knowledge-base.ts'

/**
 * Triggered by the creation of a kbLab.knowledgeBase record. Everything the
 * pipeline needs is already on that document, so the event payload only has to
 * identify it.
 */
export const handler = documentEventHandler(async ({event}) => {
  const data = event.data as {_id?: string; status?: string} | undefined
  const buildId = data?._id
  if (!buildId) {
    console.error('[build] event carried no document id')
    return
  }
  if (data.status && data.status !== 'draft') {
    console.log(`[build] ${buildId} already at status ${data.status}; skipping`)
    return
  }

  console.log(`[build] starting ${buildId}`)
  try {
    await runBuild(buildId)
    console.log(`[build] finished ${buildId}`)
  } catch (error) {
    // runBuild already recorded the failure on the document and emitted
    // build.failed; rethrow so the invocation is logged as failed too.
    console.error(`[build] failed ${buildId}`, error)
    throw error
  }
})
