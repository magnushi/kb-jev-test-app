import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import path from 'node:path'
import {config} from '../config.ts'
import type {Chunk} from './chunk.ts'
import type {Usage} from '../agents/interfaces.ts'

const client = new Anthropic({apiKey: config.llm.apiKey})

const SYSTEM_PROMPT = fs.readFileSync(
  path.join(process.cwd(), 'prompts', 'synthesize-final.md'),
  'utf8',
)

export async function synthesize(input: {
  title: string
  purpose: string
  retained: Chunk[]
  sources: {url: string; title: string}[]
}): Promise<{markdown: string; usage: Usage}> {
  const grouped = new Map<string, Chunk[]>()
  for (const chunk of input.retained) {
    const list = grouped.get(chunk.sourceUrl) ?? []
    list.push(chunk)
    grouped.set(chunk.sourceUrl, list)
  }

  const material = [...grouped.entries()]
    .map(([url, chunks]) => {
      const title = input.sources.find((s) => s.url === url)?.title ?? url
      return `## Source: ${title}\nURL: ${url}\n\n${chunks.map((c) => c.text).join('\n\n')}`
    })
    .join('\n\n---\n\n')

  const message = await client.messages.create({
    model: config.llm.synthesisModel,
    max_tokens: config.budgets.maxSynthesisOutputTokens,
    thinking: {type: 'adaptive'},
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content:
          `Knowledge base title: ${input.title}\n` +
          `Purpose: ${input.purpose}\n` +
          `Output budget: ${config.budgets.maxSynthesisOutputTokens} tokens.\n\n` +
          `Retained source material follows.\n\n${material}`,
      },
    ],
  })

  if (message.stop_reason === 'refusal') {
    throw new Error('Synthesis refused by the model')
  }
  const markdown = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  if (!markdown) throw new Error('Synthesis produced no text')

  return {
    markdown,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      // Opus 5.5: $5/M in, $25/M out.
      costUsd:
        (message.usage.input_tokens / 1_000_000) * 5 +
        (message.usage.output_tokens / 1_000_000) * 25,
    },
  }
}
