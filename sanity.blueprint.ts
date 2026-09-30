import {defineBlueprint, defineDocumentFunction, defineScheduledFunction} from '@sanity/blueprints'

/**
 * The ingestion pipeline runs here, not in a Next.js route.
 *
 * A Vercel function is torn down as soon as it responds, so background work
 * started from a route handler dies seconds later. Creating the build record
 * triggers this function instead, which gets up to 900 seconds.
 *
 * Secrets are NOT set here — this file is committed. Use:
 *   npx sanity functions env add build-knowledge-base <KEY> <value>
 */
export default defineBlueprint({
  values: {
    projectId: 'vjematwb',
    dataset: 'production',
  },
  resources: [
    defineDocumentFunction({
      name: 'build-knowledge-base',
      // Only 'create'. The function patches the record as it works, and listening
      // to 'update' as well would make it retrigger itself.
      event: {
        on: ['create'],
        filter: "_type == 'kbLab.knowledgeBase'",
        projection: '{_id, status}',
        resource: {type: 'dataset', id: 'vjematwb.production'},
      },
      timeout: 900,
      memory: 2,
    }),

    // Sanity's own build can outlive the 900s budget above, and a function that
    // dies mid-pipeline would otherwise leave a record waiting forever.
    //
    // Durable functions would fit this better — step.waitForCondition polls
    // without holding a function open — but defineDurableFunction is marked
    // "not available publicly yet". Revisit when it ships.
    defineScheduledFunction({
      name: 'reconcile-builds',
      // Every five minutes. Needs a plan that allows sub-hourly schedules;
      // Growth is hourly, Enterprise is minutely.
      event: {expression: '*/5 * * * *'},
      timeout: 120,
      memory: 1,
    }),
  ],
})
