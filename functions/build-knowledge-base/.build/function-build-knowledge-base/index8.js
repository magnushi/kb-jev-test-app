import { config } from "./index2.js";
import { createClient } from "@sanity/client";
//#region lib/providers/sanity/knowledge-base.ts
var V = config.sanity.contextApiVersion;
/** Organization-scoped client. useProjectHostname:false or the client demands a projectId. */
function orgClient(token) {
	return createClient({
		apiVersion: V,
		token,
		useCdn: false,
		useProjectHostname: false
	});
}
/** Knowledge-base-scoped client for imports, builds and jobs. */
function kbClient(token, id) {
	return createClient({
		apiVersion: V,
		token,
		useCdn: false,
		useProjectHostname: false,
		resource: {
			type: "knowledge-base",
			id
		}
	});
}
function isForbidden(error) {
	return typeof error === "object" && error !== null && error.statusCode === 403;
}
/**
* Robot tokens currently lack the `sanity.knowledge-base.create` grant, so any
* operation may 403. We try the robot token first and fall back to a user token.
*
* INTERIM — see docs/integration-notes.md §3. Delete this once the grant reaches
* `knowledge-base-editor-robot`; the robot token then covers everything.
*/
async function withFallback(run, operation) {
	try {
		return await run(config.sanity.organizationToken);
	} catch (error) {
		if (!isForbidden(error) || !config.sanity.userToken) throw error;
		console.warn(`[sanity] robot token forbidden for ${operation}; using user token fallback`);
		return run(config.sanity.userToken);
	}
}
var sanityKnowledgeBaseProvider = {
	async create({ title, purpose }) {
		return { id: (await withFallback((token) => orgClient(token).context.knowledgeBases.create({
			organizationId: config.sanity.organizationId,
			title,
			description: purpose
		}), "knowledgeBases.create")).publicId };
	},
	async importMarkdown({ knowledgeBaseId, title, markdown }) {
		return { jobId: (await withFallback((token) => kbClient(token, knowledgeBaseId).context.imports.create({
			type: "text",
			title,
			content: markdown
		}), "imports.create")).jobId };
	},
	async build({ knowledgeBaseId }) {
		return { jobId: (await withFallback((token) => kbClient(token, knowledgeBaseId).context.build(), "build")).jobId };
	},
	async status({ knowledgeBaseId }) {
		const kb = await withFallback((token) => orgClient(token).context.knowledgeBases.get(knowledgeBaseId), "knowledgeBases.get");
		const stages = kb.buildStageState?.stages;
		const active = stages?.find((s) => s.status !== "done")?.id ?? stages?.at(-1)?.id;
		return {
			id: kb.publicId,
			state: kb.state,
			isBuilding: kb.isBuilding,
			stage: active,
			openIssueCount: kb.openIssueCount
		};
	},
	async delete({ knowledgeBaseId }) {
		await withFallback((token) => orgClient(token).context.knowledgeBases.delete(knowledgeBaseId), "knowledgeBases.delete");
	}
};
//#endregion
export { sanityKnowledgeBaseProvider };

//# sourceMappingURL=index8.js.map