import {createClient, type SanityClient} from '@sanity/client'
import {config} from '../config.ts'

/** Server-side, write-capable. Never expose this client or its token to the browser. */
export const dataset: SanityClient = createClient({
  projectId: config.sanity.projectId,
  dataset: config.sanity.dataset,
  apiVersion: '2021-06-07',
  token: config.sanity.projectToken,
  useCdn: false,
})
