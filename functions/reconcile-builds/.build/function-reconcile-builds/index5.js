import { config } from "./index2.js";
import { dataset } from "./index3.js";
import { BUILD_EVENT_TYPE, KB_RECORD_TYPE } from "./index4.js";
//#region lib/db/knowledge-bases.ts
function now() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
async function patchRecord(id, fields) {
	await dataset.patch(id).set({
		...fields,
		updatedAt: now()
	}).commit({ autoGenerateArrayKeys: true });
}
/** Records beyond the retention cap, oldest first — candidates for deletion. */
async function findBeyondRetention() {
	return dataset.fetch(`*[_type == $type] | order(createdAt desc) [$limit...9999] {"id": _id, sanityKnowledgeBaseId}`, {
		type: KB_RECORD_TYPE,
		limit: config.retention.maxKnowledgeBases
	});
}
async function deleteRecord(id) {
	await dataset.delete({
		query: `*[_type == $type && buildId == $id]`,
		params: {
			type: BUILD_EVENT_TYPE,
			id
		}
	});
	await dataset.delete(id);
}
async function appendEvent(buildId, seq, event) {
	await dataset.create({
		_type: BUILD_EVENT_TYPE,
		buildId,
		seq,
		at: now(),
		event
	});
}
//#endregion
export { appendEvent, deleteRecord, findBeyondRetention, patchRecord };

//# sourceMappingURL=index5.js.map