import {dataset} from '../lib/db/client.ts'
import {KB_RECORD_TYPE} from '../lib/db/types.ts'
const rows = await dataset.fetch(`*[_type == $t]|order(createdAt desc){title,status,sanityKnowledgeBaseId,metrics,sources}`, {t: KB_RECORD_TYPE})
for (const r of rows) {
  const m = r.metrics ?? {}
  const red = m.candidateTokens ? Math.round((1 - m.retainedTokens / m.candidateTokens) * 100) : 0
  console.log(`${r.title} (${r.status})`)
  console.log(`  ${m.candidateTokens ?? '?'} candidate → ${m.retainedTokens ?? '?'} kept (${red}% withheld) → ${m.synthesisOutputTokens ?? '?'} out`)
  console.log(`  jev ${m.jevLatencyMs ?? '?'}ms $${(m.jevCostUsd ?? 0).toFixed(5)} · total $${(m.estimatedCostUsd ?? 0).toFixed(4)} · ${Math.round((m.elapsedMs ?? 0)/1000)}s`)
  console.log(`  sources: ${(r.sources ?? []).map((s:any)=>new URL(s.url).hostname.replace(/^www\./,'')).join(', ')}`)
}
