import Anthropic from '@anthropic-ai/sdk'
import {config} from '../config.ts'

const client = new Anthropic({apiKey: config.llm.apiKey})

export type AgentAnswer = {
  answer: string
  retrieved: number
  sources: {title: string; domain?: string}[]
}

/**
 * The test agent. Sanity Context MCP is read-only and does not run the agent
 * loop (spec §4 Stage G), so the loop lives here — via the Anthropic MCP
 * connector, pointed at the endpoint in Knowledge Base mode.
 *
 * Retrieval happens through the knowledge base's own tools. The synthesized
 * Markdown is deliberately NOT stuffed into the system prompt (design brief §3.4).
 */
export async function askKnowledgeBase(input: {
  knowledgeBaseId: string
  question: string
}): Promise<AgentAnswer> {
  if (!config.sanity.mcpEndpoint) {
    throw new Error(
      'No Context MCP endpoint configured. Create one in the Context app and set SANITY_MCP_ENDPOINT.',
    )
  }

  const url =
    `https://api.sanity.io/v1/context/organizations/${config.sanity.organizationId}` +
    `/mcp/${config.sanity.mcpEndpoint}` +
    `?mode=knowledge_base&knowledgeBases=${encodeURIComponent(input.knowledgeBaseId)}`

  const message = await client.beta.messages.create({
    model: config.llm.synthesisModel,
    max_tokens: 4096,
    thinking: {type: 'adaptive'},
    betas: ['mcp-client-2025-11-20'],
    mcp_servers: [
      {
        type: 'url',
        url,
        name: 'sanity_context',
        authorization_token: config.sanity.organizationToken,
      },
    ],
    tools: [{type: 'mcp_toolset', mcp_server_name: 'sanity_context'}],
    system:
      'You answer strictly from the Sanity Knowledge Base available through your tools. ' +
      'Always retrieve before answering; never answer from your own knowledge. ' +
      'If the knowledge base does not cover the question, say so plainly and list what it ' +
      'does cover. Be concise and concrete. Do not mention tool names.',
    messages: [{role: 'user', content: input.question}],
  })

  const answer = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  // Count real retrievals and name the entries actually read, so the
  // "N entries retrieved" line is never invented.
  const sources: {title: string; domain?: string}[] = []
  let retrieved = 0
  for (const block of message.content) {
    if (block.type !== 'mcp_tool_result') continue
    retrieved += 1
    const content = (block as {content?: unknown}).content
    if (Array.isArray(content)) {
      for (const part of content) {
        const text = (part as {text?: string}).text
        if (!text) continue
        const heading = /^#{1,3}\s*(.+)$/m.exec(text)?.[1] ?? text.slice(0, 60)
        sources.push({title: heading.trim()})
      }
    }
  }

  return {
    answer: answer || 'The knowledge base returned nothing for that question.',
    retrieved,
    sources: sources.slice(0, 8),
  }
}
