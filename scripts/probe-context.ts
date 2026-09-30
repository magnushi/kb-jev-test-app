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
  context: {organizationId: config.sanity.organizationId},
})

const entries = await kb.context.entries.list()
console.log('=== raw first entry (list) ===')
console.log(JSON.stringify(entries[0], null, 2).slice(0, 700))
console.log('\n=== neighbors present? ===')
console.log(entries.map((e:any) => `${e.path}: ${(e.tldr?.neighbors ?? []).length}`).join('  '))
console.log('\n=== paths contain a slash? ===')
console.log(entries.some((e:any) => e.path.includes('/')) ? 'YES — hierarchy' : 'NO — flat')
console.log('\n=== entries.get (topics + citations) ===')
const full = await kb.context.entries.get({path: entries[0]!.path})
const f = full as any
console.log('topicHeadings:', JSON.stringify(f?.topicHeadings))
console.log('citations:', Array.isArray(f?.citations) ? f.citations.length : f?.citations)
console.log('\n=== issues ===')
try { const iss = await kb.context.issues.list(); console.log(`${(iss as any).data?.length ?? (iss as any).length ?? 0} issue(s)`) }
catch (e:any) { console.log('issues:', e.statusCode, String(e.message).slice(0,80)) }
console.log('\n=== mcp endpoints in org ===')
try { const m = await org.context.mcpEndpoints.list(); console.log(`${m.length}:`, m.map((x:any)=>x.name).join(', ') || '(none)') }
catch (e:any) { console.log('mcpEndpoints:', e.statusCode, String(e.message).slice(0,80)) }
