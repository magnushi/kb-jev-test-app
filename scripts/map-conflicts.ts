import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'
const kb = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false, useProjectHostname: false,
  resource: {type: 'knowledge-base', id: 'kbt432byCXWQ'},
  context: {organizationId: config.sanity.organizationId},
})
const issues = (await kb.context.issues.list({status: 'open'})) as any[]
for (const i of issues) {
  const c = i.content
  console.log(`\n${i._id}  (${c.claimKey})  suggested=${c.suggested}`)
  ;(c.sides ?? []).forEach((s: any, n: number) => {
    const isEntrySide = Array.isArray(s.entryPaths) && s.entryPaths.length > 0
    console.log(`  [${n}] ${isEntrySide ? 'CURRENT ENTRY' : 'source/other  '}  ${String(s.value ?? s.claim).slice(0, 86)}`)
  })
}
