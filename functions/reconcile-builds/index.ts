import {scheduledEventHandler} from '@sanity/functions'
import {reconcileBuilds} from '../../lib/workflows/reconcile.ts'

/**
 * Runs on a schedule. Finishes builds whose Sanity build outlived the build
 * function's budget, fails ones that were abandoned, and enforces retention.
 */
export const handler = scheduledEventHandler(async () => {
  const {checked, resolved} = await reconcileBuilds()
  console.log(`[reconcile] checked ${checked}, resolved ${resolved}`)
})
