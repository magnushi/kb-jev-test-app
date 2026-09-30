import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'
const id = process.argv[2]!
const kb = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false, useProjectHostname: false,
  resource: {type: 'knowledge-base', id},
  context: {organizationId: config.sanity.organizationId},
})
const org = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false, useProjectHostname: false,
})

const all = await kb.context.issues.list()
const open = await kb.context.issues.list({status: 'open'})
console.log(`all=${all.length}  open=${open.length}`)
for (const i of all as any[]) {
  console.log(`  ${String(i.status).padEnd(9)} ${String(i.content?.kind).padEnd(16)} ${String(i.content?.severity).padEnd(11)} ${String(i.content?.scopePath ?? '')}`)
}
const REVIEWABLE = new Set(['conflict','add_entry','remove_entry','split_entry','merge_entry'])
const reviewable = (open as any[]).filter(i => REVIEWABLE.has(i.content?.kind))
console.log(`\nreviewable (open, non-gap): ${reviewable.length}`)
const rec = await org.context.knowledgeBases.get(id)
console.log(`openIssueCount on record: ${(rec as any).openIssueCount}`)
console.log(`state: ${rec.state}  isBuilding: ${rec.isBuilding}`)
