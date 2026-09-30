import {dataset} from '../lib/db/client.ts'
import {KB_RECORD_TYPE, BUILD_EVENT_TYPE} from '../lib/db/types.ts'
const [recs, evs] = await Promise.all([
  dataset.fetch<number>(`count(*[_type == $t])`, {t: KB_RECORD_TYPE}),
  dataset.fetch<number>(`count(*[_type == $t])`, {t: BUILD_EVENT_TYPE}),
])
console.log(`dataset documents: ${recs} build records, ${evs} build events`)
