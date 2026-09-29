import {dataset} from './client.ts'
import {
  BUILD_EVENT_TYPE,
  KB_RECORD_TYPE,
  type BuildEvent,
  type BuildMetrics,
  type BuildStatus,
  type KnowledgeBaseRecord,
  type PublicKnowledgeBase,
  type SourceRecord,
  type StoredBuildEvent,
} from './types.ts'
import {config} from '../config.ts'

function now(): string {
  return new Date().toISOString()
}

export async function createRecord(input: {
  title: string
  purpose: string
  topic: string
  sources: SourceRecord[]
  sessionId: string
  makerName?: string
  makerEmail?: string
}): Promise<KnowledgeBaseRecord> {
  const timestamp = now()
  const doc = {
    _type: KB_RECORD_TYPE,
    ...input,
    status: 'draft' satisfies BuildStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return (await dataset.create(doc)) as unknown as KnowledgeBaseRecord
}

export async function patchRecord(
  id: string,
  fields: Partial<Pick<KnowledgeBaseRecord,
    'status' | 'sanityKnowledgeBaseId' | 'sources' | 'metrics' | 'error' | 'title' | 'purpose'>>,
): Promise<void> {
  await dataset.patch(id).set({...fields, updatedAt: now()}).commit({autoGenerateArrayKeys: true})
}

export async function getRecord(id: string): Promise<KnowledgeBaseRecord | null> {
  return dataset.fetch(`*[_type == $type && _id == $id][0]`, {type: KB_RECORD_TYPE, id})
}

/**
 * Newest first, capped at the retention limit. The cap is a product decision
 * (DECISIONS.md): the list shows at most 50 knowledge bases.
 */
export async function listPublic(limit = config.retention.maxKnowledgeBases): Promise<PublicKnowledgeBase[]> {
  return dataset.fetch(
    `*[_type == $type && status == "ready"] | order(createdAt desc) [0...$limit] {
      "id": _id, title, purpose, makerName, status, sanityKnowledgeBaseId, createdAt
    }`,
    {type: KB_RECORD_TYPE, limit},
  )
}

/** Records beyond the retention cap, oldest first — candidates for deletion. */
export async function findBeyondRetention(): Promise<{id: string; sanityKnowledgeBaseId?: string}[]> {
  return dataset.fetch(
    `*[_type == $type] | order(createdAt desc) [$limit...9999] {"id": _id, sanityKnowledgeBaseId}`,
    {type: KB_RECORD_TYPE, limit: config.retention.maxKnowledgeBases},
  )
}

export async function deleteRecord(id: string): Promise<void> {
  await dataset.delete({query: `*[_type == $type && buildId == $id]`, params: {type: BUILD_EVENT_TYPE, id}})
  await dataset.delete(id)
}

/**
 * Maker fields are editable only by the session that created the record, so
 * visitors cannot rename each other's builds (design brief §9).
 */
export async function setMaker(input: {
  id: string
  sessionId: string
  makerName?: string
  makerEmail?: string
}): Promise<boolean> {
  const record = await getRecord(input.id)
  if (!record || record.sessionId !== input.sessionId) return false
  await dataset
    .patch(input.id)
    .set({makerName: input.makerName, makerEmail: input.makerEmail, updatedAt: now()})
    .commit()
  return true
}

export async function appendEvent(buildId: string, seq: number, event: BuildEvent): Promise<void> {
  await dataset.create({
    _type: BUILD_EVENT_TYPE,
    buildId,
    seq,
    at: now(),
    event,
  })
}

export async function listEvents(buildId: string, afterSeq = -1): Promise<StoredBuildEvent[]> {
  return dataset.fetch(
    `*[_type == $type && buildId == $buildId && seq > $afterSeq] | order(seq asc)`,
    {type: BUILD_EVENT_TYPE, buildId, afterSeq},
  )
}

export type {BuildMetrics}
