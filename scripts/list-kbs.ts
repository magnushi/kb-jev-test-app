import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'
const c = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false, useProjectHostname: false,
})
const res = await c.context.knowledgeBases.list({organizationId: config.sanity.organizationId})
console.log(`${res.data.length} knowledge base(s) in ${config.sanity.organizationId}`)
for (const kb of res.data) console.log(`  ${kb.publicId}  ${kb.state.padEnd(10)} ${kb.title}`)
if (process.argv.includes('--purge')) {
  for (const kb of res.data) { await c.context.knowledgeBases.delete(kb.publicId); console.log('deleted', kb.publicId) }
}
