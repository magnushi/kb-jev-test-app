import {sanityKnowledgeBaseProvider as p} from '../lib/providers/sanity/knowledge-base.ts'
const id = process.argv[2]!
console.log(JSON.stringify(await p.status({knowledgeBaseId: id}), null, 2))
