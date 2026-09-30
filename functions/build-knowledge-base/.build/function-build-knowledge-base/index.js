import { runBuild } from "./index12.js";
import { documentEventHandler } from "@sanity/functions";
//#region functions/build-knowledge-base/index.ts
/**
* Triggered by the creation of a kbLab.knowledgeBase record. Everything the
* pipeline needs is already on that document, so the event payload only has to
* identify it.
*/
var handler = documentEventHandler(async ({ event }) => {
	const data = event.data;
	const buildId = data?._id;
	if (!buildId) {
		console.error("[build] event carried no document id");
		return;
	}
	if (data.status && data.status !== "draft") {
		console.log(`[build] ${buildId} already at status ${data.status}; skipping`);
		return;
	}
	console.log(`[build] starting ${buildId}`);
	try {
		await runBuild(buildId);
		console.log(`[build] finished ${buildId}`);
	} catch (error) {
		console.error(`[build] failed ${buildId}`, error);
		throw error;
	}
});
//#endregion
export { handler };

//# sourceMappingURL=index.js.map