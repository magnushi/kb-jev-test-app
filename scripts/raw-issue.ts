import {createClient} from '@sanity/client'
import {config} from '../lib/config.ts'
const kb = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false, useProjectHostname: false,
  resource: {type: 'knowledge-base', id: 'kbt432byCXWQ'},
  context: {organizationId: config.sanity.organizationId},
})
const doc = await kb.context.issues.get({issueId: process.argv[2]!})
console.log(JSON.stringify(doc, null, 2).slice(0, 2500))
