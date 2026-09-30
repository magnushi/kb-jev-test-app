import Anthropic from '@anthropic-ai/sdk'
import {config} from '../../config.ts'
import type {Candidate, SearchProvider} from '../../agents/interfaces.ts'

const client = new Anthropic({apiKey: config.llm.apiKey})

/**
 * Discovery only. The tool returns URLs and snippets; our own fetcher still does
 * the fetching, extraction and SSRF checks, so the model never browses a page
 * itself (spec §4 Stage B).
 */
export const anthropicSearchProvider: SearchProvider = {
  async discover({topic, maxResults}) {
    const message = await client.messages.create({
      model: config.llm.synthesisModel,
      max_tokens: 4096,
      thinking: {type: 'adaptive'},
      tools: [{type: 'web_search_20260209', name: 'web_search', max_uses: 3}],
      messages: [
        {
          role: 'user',
          content:
            `Find authoritative, information-dense pages about: ${topic}\n\n` +
            'Prefer primary sources: official documentation, specifications, reference ' +
            'material and encyclopaedic overviews. Avoid marketing pages, listicles and ' +
            'SEO filler. Search, then stop — do not summarise what you found.',
        },
      ],
    })

    const found = new Map<string, Candidate>()
    outer: for (const block of message.content) {
      if (block.type !== 'web_search_tool_result') continue
      // Server-tool errors arrive as HTTP 200 with an object, not a list.
      if (!Array.isArray(block.content)) {
        console.warn('[search] tool error', block.content)
        continue
      }
      for (const result of block.content) {
        if (result.type !== 'web_search_result') continue
        const host = safeHost(result.url)
        if (!host) continue
        // One page per domain, so three sources mean three perspectives.
        if ([...found.values()].some((f) => safeHost(f.url) === host)) continue
        found.set(result.url, {
          url: result.url,
          title: result.title,
          pageAge: result.page_age ?? undefined,
        })
        if (found.size >= maxResults) break outer
      }
    }
    return [...found.values()]
  },
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
