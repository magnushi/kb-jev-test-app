import {dataset} from '../lib/db/client.ts'
import {KB_RECORD_TYPE, BUILD_EVENT_TYPE} from '../lib/db/types.ts'
const rec = await dataset.fetch(`*[_type == $t]|order(createdAt desc)[0]`, {t: KB_RECORD_TYPE})
if (!rec) { console.log('no records'); process.exit(0) }
console.log(`status=${rec.status} kb=${rec.sanityKnowledgeBaseId ?? '-'} updated=${rec.updatedAt}`)
console.log('metrics:', JSON.stringify(rec.metrics))
const evs = await dataset.fetch(`*[_type == $t && buildId == $b]|order(seq asc){seq, event}`, {t: BUILD_EVENT_TYPE, b: rec._id})
const kept = evs.filter((e:any)=>e.event.type==='jev.evaluation' && e.event.decision!=='drop').length
const dropped = evs.filter((e:any)=>e.event.type==='jev.evaluation' && e.event.decision==='drop').length
console.log(`events=${evs.length}  jev kept=${kept} dropped=${dropped}`)
console.log('last 3:', evs.slice(-3).map((e:any)=>e.event.type).join(' → '))
const scores = evs.filter((e:any)=>e.event.type==='jev.evaluation').map((e:any)=>e.event.score)
if (scores.length) console.log(`scores: min=${Math.min(...scores)} max=${Math.max(...scores)}`)
