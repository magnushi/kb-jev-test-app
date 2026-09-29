import {interpretIntent} from '../lib/ingestion/intent.ts'
import {anthropicSearchProvider} from '../lib/providers/search/index.ts'
import {config} from '../lib/config.ts'

const requests = [
  'Make me a knowledge base about California wildfire insurance',
  'I want a knowledge base that helps an agent answer questions about MCP',
  'Build a knowledge base from https://docs.typesafe.ai/primitives/noul.md',
]

for (const request of requests) {
  const intent = await interpretIntent(request)
  console.log(`\n"${request}"`)
  console.log(`  name    "${intent.title} Knowledge Base"`)
  console.log(`  purpose ${intent.purpose}`)
  console.log(`  topic   ${intent.topic}`)
  console.log(`  urls    ${intent.userUrls.length ? intent.userUrls.join(', ') : '(none — will discover)'}`)
  if (intent.userUrls.length === 0) {
    const found = await anthropicSearchProvider.discover({topic: intent.topic, maxResults: config.budgets.maxSources})
    for (const s of found) console.log(`    → ${new URL(s.url).hostname.padEnd(26)} ${s.title ?? ''}`)
  }
}
