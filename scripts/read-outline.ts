import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'

const id = process.argv[2]!
const kb = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false,
  useProjectHostname: false,
  resource: {type: 'knowledge-base', id},
  context: {organizationId: config.sanity.organizationId},
})

const entries = await kb.context.entries.list()
console.log(`${entries.length} entries\n`)
for (const e of entries) {
  const t = e.tldr as undefined | {scope?: string; excludes?: string; neighbors?: string[]; centrality?: string}
  console.log(`${(t?.centrality ?? '-').padEnd(10)} ${e.path}`)
  console.log(`           title: ${e.title}`)
  if (t?.scope) console.log(`           scope: ${t.scope.slice(0, 92)}`)
  if (t?.neighbors?.length) console.log(`           neighbors: ${t.neighbors.join(', ')}`)
}
