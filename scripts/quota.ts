import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'
const org = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false, useProjectHostname: false,
})
const res = await org.context.knowledgeBases.list({organizationId: config.sanity.organizationId})
console.log(`${res.data.length} knowledge base(s)`)
const kb = res.data[0] as any
if (kb) console.log('sourceUsage on first:', JSON.stringify(kb.sourceUsage), 'buildRestriction:', JSON.stringify(kb.buildRestriction))
