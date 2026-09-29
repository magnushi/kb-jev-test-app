import Anthropic from '@anthropic-ai/sdk'
import {config} from '../config.ts'

const client = new Anthropic({apiKey: config.llm.apiKey})

export type BuildIntent = {
  /** The [Name] part only; the UI appends " Knowledge Base" (design brief §4). */
  title: string
  purpose: string
  topic: string
  userUrls: string[]
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'purpose', 'topic'],
  properties: {
    title: {
      type: 'string',
      description:
        'Short subject name in Title Case, at most five words. Keep acronyms uppercase ' +
        '(MCP, GROQ) and small words lowercase mid-name (for, and, of). Do NOT include ' +
        'the words "Knowledge Base".',
    },
    purpose: {
      type: 'string',
      description: 'One sentence describing what an agent should be able to answer from this.',
    },
    topic: {type: 'string', description: 'A search-ready phrase describing the subject matter.'},
  },
} as const

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g

/** Stage A — the primary LLM is used once, to turn the chat into structure. */
export async function interpretIntent(message: string): Promise<BuildIntent> {
  const userUrls = [...new Set(message.match(URL_PATTERN) ?? [])].slice(0, config.budgets.maxSources)

  const response = await client.messages.create({
    model: config.llm.synthesisModel,
    max_tokens: 2048,
    thinking: {type: 'adaptive'},
    output_config: {format: {type: 'json_schema', schema: SCHEMA}},
    system:
      'You turn a short request into a knowledge base specification. Be faithful to what ' +
      'was asked; do not broaden the subject. If only URLs were given, infer the subject ' +
      'from their domains and paths.',
    messages: [{role: 'user', content: message}],
  })

  if (response.stop_reason === 'refusal') throw new Error('Could not interpret that request')

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')

  const parsed = JSON.parse(text) as Omit<BuildIntent, 'userUrls'>
  return {...parsed, userUrls}
}
