import {interpretIntent} from '../lib/ingestion/intent.ts'
import {anthropicSearchProvider} from '../lib/providers/search/index.ts'
import {jevCandidateRanker} from '../lib/providers/jev/index.ts'
import {config} from '../lib/config.ts'

const intent = await interpretIntent(process.argv[2] ?? 'Quantum computers')
console.log(`purpose: ${intent.purpose}\n`)
const candidates = await anthropicSearchProvider.discover({
  topic: intent.topic,
  maxResults: config.budgets.maxCandidateUrls,
})
console.log(`${candidates.length} candidates found`)
const {ranked, latencyMs, usage} = await jevCandidateRanker.rank({
  purpose: intent.purpose,
  topic: intent.topic,
  candidates,
})
console.log(`Jev ranked them in ${latencyMs}ms for $${usage.costUsd?.toFixed(6)}\n`)
ranked.forEach((c, i) => {
  const mark = i < config.budgets.maxSources ? '→ CHOSEN ' : '  rejected'
  console.log(`  ${c.score.toFixed(2)} ${mark} ${new URL(c.url).hostname.replace(/^www\./, '').padEnd(28)} ${(c.title ?? '').slice(0, 52)}`)
})
