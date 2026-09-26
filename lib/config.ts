import fs from 'node:fs'
import path from 'node:path'

/** Load .env.local into process.env without a dependency. Server-only. */
function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq)
    if (process.env[key] === undefined) process.env[key] = trimmed.slice(eq + 1)
  }
}
loadEnvFile(path.join(process.cwd(), '.env.local'))

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const config = {
  jev: {
    apiKey: required('TYPESAFE_API_KEY'),
    model: process.env.JEV_MODEL ?? 'jev-latest',
    baseUrl: 'https://api.typesafe.ai/v1/systemone',
  },
  llm: {
    apiKey: required('ANTHROPIC_API_KEY'),
    synthesisModel: process.env.SYNTHESIS_MODEL ?? 'claude-opus-5-5',
  },
  sanity: {
    organizationId: required('SANITY_ORGANIZATION_ID'),
    projectId: required('SANITY_PROJECT_ID'),
    dataset: process.env.SANITY_DATASET ?? 'production',
    organizationToken: required('SANITY_ORGANIZATION_TOKEN'),
    projectToken: required('SANITY_PROJECT_TOKEN'),
    /** Interim: robot tokens cannot create knowledge bases. See docs/integration-notes.md §3. */
    userToken: process.env.SANITY_USER_TOKEN,
    contextApiVersion: process.env.SANITY_CONTEXT_API_VERSION ?? '2026-08-25',
  },
  budgets: {
    maxSources: 3,
    maxCandidateUrls: Number(process.env.SEARCH_MAX_CANDIDATE_URLS ?? 10),
    maxFetchedBytes: 2_000_000,
    maxCandidateTokens: 40_000,
    maxSynthesisInputTokens: 30_000,
    maxSynthesisOutputTokens: 12_000,
    fetchTimeoutMs: 15_000,
    /** Jev allows 32k for state + longest question; stay well inside it. */
    maxChunksPerJevCall: 20,
  },
  relevance: {
    keepAbove: 0.8,
    dropBelow: 0.2,
  },
} as const
