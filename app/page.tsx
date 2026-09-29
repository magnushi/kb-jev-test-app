import {Lab} from '../components/Lab.tsx'
import {listPublic} from '../lib/db/knowledge-bases.ts'

export const dynamic = 'force-dynamic'

export default async function LabPage() {
  const knowledgeBases = await listPublic()
  return <Lab initialCount={knowledgeBases.length} />
}
