import { config } from "./index2.js";
import { createClient } from "@sanity/client";
//#region lib/db/client.ts
/** Server-side, write-capable. Never expose this client or its token to the browser. */
var dataset = createClient({
	projectId: config.sanity.projectId,
	dataset: config.sanity.dataset,
	apiVersion: "2021-06-07",
	token: config.sanity.projectToken,
	useCdn: false
});
//#endregion
export { dataset };

//# sourceMappingURL=index3.js.map