import "./index2.js";
import { deleteRecord, findBeyondRetention } from "./index5.js";
import { sanityKnowledgeBaseProvider } from "./index6.js";
import "./index7.js";
import "./index8.js";
import "./index9.js";
import "./index10.js";
//#region lib/workflows/build-knowledge-base.ts
/**
* Keeps the gallery — and the organization — bounded. Deletes the oldest records
* beyond the cap, and the Sanity Knowledge Bases behind them.
*/
async function enforceRetention() {
	for (const stale of await findBeyondRetention()) {
		if (stale.sanityKnowledgeBaseId) await sanityKnowledgeBaseProvider.delete({ knowledgeBaseId: stale.sanityKnowledgeBaseId }).catch((error) => console.warn("[retention] KB delete failed", error));
		await deleteRecord(stale.id);
	}
}
//#endregion
export { enforceRetention };

//# sourceMappingURL=index11.js.map