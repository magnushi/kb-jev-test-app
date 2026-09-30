import { dataset } from "./index3.js";
import { KB_RECORD_TYPE } from "./index4.js";
import { appendEvent, patchRecord } from "./index5.js";
import { sanityKnowledgeBaseProvider } from "./index6.js";
import { enforceRetention } from "./index11.js";
//#region lib/workflows/reconcile.ts
/** A build function can time out, or Sanity's own build can outlive it. */
var STUCK_AFTER_MS = 12e5;
/**
* Moves builds out of limbo. Two cases:
*   - waiting on Sanity's build, which can outlive the 900s function budget
*   - abandoned mid-pipeline, because the function died
*
* Without this, a record can sit in `building_kb` forever and the UI waits on a
* build nobody is driving.
*/
async function reconcileBuilds() {
	const stale = await dataset.fetch(`*[_type == $type && !(status in ["ready", "failed"])] | order(createdAt asc) [0...25]`, { type: KB_RECORD_TYPE });
	let resolved = 0;
	for (const record of stale) {
		const age = Date.now() - new Date(record.updatedAt).getTime();
		if (record.sanityKnowledgeBaseId) try {
			const status = await sanityKnowledgeBaseProvider.status({ knowledgeBaseId: record.sanityKnowledgeBaseId });
			if (!status.isBuilding && status.state !== "building") {
				await patchRecord(record._id, { status: "ready" });
				await appendEvent(record._id, Date.now(), { type: "sanity.kb.ready" });
				resolved += 1;
				continue;
			}
			if (status.stage) await appendEvent(record._id, Date.now(), {
				type: "sanity.kb.building",
				stage: status.stage
			});
		} catch (error) {
			console.warn(`[reconcile] status failed for ${record._id}`, error);
		}
		if (!record.sanityKnowledgeBaseId && age > STUCK_AFTER_MS) {
			await patchRecord(record._id, {
				status: "failed",
				error: "The build stopped before finishing. Try again."
			});
			await appendEvent(record._id, Date.now(), {
				type: "build.failed",
				message: "The build stopped before finishing. Try again."
			});
			resolved += 1;
		}
	}
	await enforceRetention();
	return {
		checked: stale.length,
		resolved
	};
}
//#endregion
export { reconcileBuilds };

//# sourceMappingURL=index12.js.map