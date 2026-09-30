import {dataset} from '../lib/db/client.ts'
import {KB_RECORD_TYPE} from '../lib/db/types.ts'
const rows = await dataset.fetch(`*[_type == $t]|order(createdAt desc){_id,title,status,sanityKnowledgeBaseId}`, {t: KB_RECORD_TYPE})
for (const r of rows) console.log(`${r._id}  ${String(r.status).padEnd(12)} ${r.sanityKnowledgeBaseId ?? '-'}  ${r.title}`)
console.log(`${rows.length} record(s)`)
