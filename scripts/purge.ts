import {createClient} from '@sanity/client'
import {dataset} from '../lib/db/client.ts'
import {KB_RECORD_TYPE, BUILD_EVENT_TYPE} from '../lib/db/types.ts'
import {config} from '../lib/config.ts'

const org = createClient({
  apiVersion: config.sanity.contextApiVersion,
  token: config.sanity.userToken ?? config.sanity.organizationToken,
  useCdn: false,
  useProjectHostname: false,
})

const kbs = await org.context.knowledgeBases.list({organizationId: config.sanity.organizationId})
console.log(`Knowledge Bases to delete: ${kbs.data.length}`)
for (const kb of kbs.data) console.log(`  ${kb.publicId}  ${kb.title}`)

const [recs, evs] = await Promise.all([
  dataset.fetch<number>(`count(*[_type == $t])`, {t: KB_RECORD_TYPE}),
  dataset.fetch<number>(`count(*[_type == $t])`, {t: BUILD_EVENT_TYPE}),
])
console.log(`App records to delete: ${recs} build records, ${evs} build events`)

if (!process.argv.includes('--yes')) {
  console.log('\nDry run. Pass --yes to delete.')
  process.exit(0)
}

for (const kb of kbs.data) {
  await org.context.knowledgeBases.delete(kb.publicId)
  console.log(`deleted KB ${kb.publicId}`)
}
await dataset.delete({query: `*[_type == $t]`, params: {t: BUILD_EVENT_TYPE}})
await dataset.delete({query: `*[_type == $t]`, params: {t: KB_RECORD_TYPE}})
console.log('deleted app records and events')

const left = await org.context.knowledgeBases.list({organizationId: config.sanity.organizationId})
console.log(`\nRemaining Knowledge Bases: ${left.data.length}`)
