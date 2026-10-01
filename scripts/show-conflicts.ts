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
const issues = (await kb.context.issues.list({status: 'open'})) as any[]
issues.forEach((i, n) => {
  const c = i.content ?? {}
  console.log(`\n═══ ISSUE ${n + 1} ═══  id=${i._id}`)
  console.log(`kind=${c.kind} severity=${c.severity} scope=${c.scopePath}`)
  console.log(`involvedScopes=${JSON.stringify(c.involvedScopes)}`)
  console.log(`\nISSUE:\n${c.issue ?? '(none)'}`)
  console.log(`\nSUGGESTED FIX:\n${c.suggestedFix ?? '(none)'}`)
  console.log(`\nclaimKey=${c.claimKey ?? '-'}`)
  console.log(`currentClaim=${c.currentClaim ?? '-'}`)
  console.log(`alternativeClaim=${c.alternativeClaim ?? '-'}`)
  console.log(`citedSourceIds=${JSON.stringify(c.citedSourceIds)}`)
})
