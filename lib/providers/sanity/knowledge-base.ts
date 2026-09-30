import {createClient, type SanityClient} from '@sanity/client'
import {config} from '../../config.ts'
import type {
  Centrality,
  KnowledgeBaseProvider,
  KnowledgeBaseStatus,
  OutlineEntry,
} from '../../agents/interfaces.ts'

const V = config.sanity.contextApiVersion

/** Organization-scoped client. useProjectHostname:false or the client demands a projectId. */
function orgClient(token: string): SanityClient {
  return createClient({apiVersion: V, token, useCdn: false, useProjectHostname: false})
}

/** Knowledge-base-scoped client for imports, builds and jobs. */
function kbClient(token: string, id: string): SanityClient {
  return createClient({
    apiVersion: V,
    token,
    useCdn: false,
    useProjectHostname: false,
    resource: {type: 'knowledge-base', id},
    // Reading entries and issues goes through the organization's document
    // store, which needs the organization id as well as the resource.
    context: {organizationId: config.sanity.organizationId},
  })
}

function isForbidden(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as {statusCode?: number}).statusCode === 403
}

/**
 * Robot tokens currently lack the `sanity.knowledge-base.create` grant, so any
 * operation may 403. We try the robot token first and fall back to a user token.
 *
 * INTERIM — see docs/integration-notes.md §3. Delete this once the grant reaches
 * `knowledge-base-editor-robot`; the robot token then covers everything.
 */
async function withFallback<T>(run: (token: string) => Promise<T>, operation: string): Promise<T> {
  try {
    return await run(config.sanity.organizationToken)
  } catch (error) {
    if (!isForbidden(error) || !config.sanity.userToken) throw error
    console.warn(`[sanity] robot token forbidden for ${operation}; using user token fallback`)
    return run(config.sanity.userToken)
  }
}

export const sanityKnowledgeBaseProvider: KnowledgeBaseProvider = {
  async create({title, purpose}) {
    const kb = await withFallback(
      (token) =>
        orgClient(token).context.knowledgeBases.create({
          organizationId: config.sanity.organizationId,
          title,
          description: purpose,
        }),
      'knowledgeBases.create',
    )
    return {id: kb.publicId}
  },

  async importMarkdown({knowledgeBaseId, title, markdown}) {
    const res = await withFallback(
      (token) =>
        kbClient(token, knowledgeBaseId).context.imports.create({
          type: 'text',
          title,
          content: markdown,
        }),
      'imports.create',
    )
    return {jobId: res.jobId}
  },

  async build({knowledgeBaseId}) {
    const res = await withFallback(
      (token) => kbClient(token, knowledgeBaseId).context.build(),
      'build',
    )
    return {jobId: res.jobId}
  },

  async status({knowledgeBaseId}): Promise<KnowledgeBaseStatus> {
    const kb = await withFallback(
      (token) => orgClient(token).context.knowledgeBases.get(knowledgeBaseId),
      'knowledgeBases.get',
    )
    const stages = (kb as {buildStageState?: {stages?: {id: string; status: string}[]}}).buildStageState?.stages
    const active = stages?.find((s) => s.status !== 'done')?.id ?? stages?.at(-1)?.id
    return {
      id: kb.publicId,
      state: kb.state,
      isBuilding: kb.isBuilding,
      stage: active,
      stages,
      openIssueCount: (kb as {openIssueCount?: number}).openIssueCount,
    }
  },

  async outline({knowledgeBaseId}): Promise<OutlineEntry[]> {
    const entries = await withFallback(
      (token) => kbClient(token, knowledgeBaseId).context.entries.list(),
      'entries.list',
    )
    type Tldr = {
      scope?: string
      excludes?: string
      neighbors?: string[]
      centrality?: Centrality
    }
    return entries
      .filter((entry) => entry.status === 'filled')
      .map((entry) => {
        const tldr = entry.tldr as Tldr | undefined
        return {
          path: entry.path,
          title: entry.title,
          centrality: tldr?.centrality ?? 'standard',
          summary: tldr?.scope ?? '',
          excludes: tldr?.excludes,
          neighbors: tldr?.neighbors ?? [],
        }
      })
  },

  async delete({knowledgeBaseId}) {
    await withFallback(
      (token) => orgClient(token).context.knowledgeBases.delete(knowledgeBaseId),
      'knowledgeBases.delete',
    )
  },
}
