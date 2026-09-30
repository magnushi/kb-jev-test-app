import { reconcileBuilds } from "./index12.js";
import { scheduledEventHandler } from "@sanity/functions";
//#region functions/reconcile-builds/index.ts
/**
* Runs on a schedule. Finishes builds whose Sanity build outlived the build
* function's budget, fails ones that were abandoned, and enforces retention.
*/
var handler = scheduledEventHandler(async () => {
	const { checked, resolved } = await reconcileBuilds();
	console.log(`[reconcile] checked ${checked}, resolved ${resolved}`);
});
//#endregion
export { handler };

//# sourceMappingURL=index.js.map