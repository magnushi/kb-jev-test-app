import { config } from "./index2.js";
import { fetchPage } from "./index3.js";
import { extractReadableText } from "./index4.js";
import { chunkText, estimateTokens } from "./index5.js";
import { jevRelevanceGate } from "./index6.js";
import { synthesize } from "./index7.js";
import { sanityKnowledgeBaseProvider } from "./index8.js";
import { appendEvent, deleteRecord, findBeyondRetention, getRecord, patchRecord } from "./index11.js";
//#region lib/workflows/build-knowledge-base.ts
/**
* The ingestion workflow: a bounded sequence with hard limits, not an agent loop
* (spec §5). Every number the UI shows is emitted from here, so the knowledge map
* and the token strip can never disagree.
*/
async function runBuild(buildId) {
	const started = Date.now();
	let seq = 0;
	const emit = async (event) => {
		await appendEvent(buildId, seq++, event);
	};
	const record = await getRecord(buildId);
	if (!record) throw new Error(`No such build: ${buildId}`);
	const metrics = {
		candidateTokens: 0,
		retainedTokens: 0,
		synthesisInputTokens: 0,
		synthesisOutputTokens: 0,
		jevCalls: 0,
		jevLatencyMs: 0,
		llmCalls: 0,
		elapsedMs: 0
	};
	try {
		const urls = record.sources.slice(0, config.budgets.maxSources).map((s) => s.url);
		await emit({
			type: "build.started",
			sourceUrls: urls
		});
		await patchRecord(buildId, { status: "fetching" });
		const chunks = [];
		const sources = [];
		for (const [index, url] of urls.entries()) {
			await emit({
				type: "source.fetch.started",
				url
			});
			try {
				const page = await fetchPage(url);
				const extraction = extractReadableText(page.html, page.url);
				const pageChunks = chunkText(extraction.text, page.url, index);
				const tokens = pageChunks.reduce((sum, c) => sum + c.tokens, 0);
				if (metrics.candidateTokens + tokens > config.budgets.maxCandidateTokens) throw new Error("Candidate token budget exhausted");
				metrics.candidateTokens += tokens;
				chunks.push(...pageChunks);
				sources.push({
					url: page.url,
					title: page.title,
					fetchedBytes: page.bytes,
					candidateTokens: tokens,
					chunksTotal: pageChunks.length
				});
				await emit({
					type: "source.fetch.finished",
					url: page.url,
					title: page.title,
					bytes: page.bytes,
					tokens,
					chunks: pageChunks.length
				});
				for (const chunk of pageChunks) await emit({
					type: "chunk.ready",
					chunkId: chunk.id,
					sourceUrl: chunk.sourceUrl,
					label: chunk.label,
					tokens: chunk.tokens
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				sources.push({
					url,
					error: message
				});
				await emit({
					type: "source.fetch.failed",
					url,
					message
				});
			}
		}
		if (chunks.length === 0) throw new Error("No source could be read");
		await patchRecord(buildId, { sources });
		await patchRecord(buildId, { status: "filtering" });
		const gate = await jevRelevanceGate.evaluate({
			purpose: record.purpose,
			topic: record.topic,
			chunks: chunks.map((c) => ({
				id: c.id,
				text: c.text
			}))
		});
		metrics.jevCalls = Math.ceil(chunks.length / config.budgets.maxChunksPerJevCall);
		metrics.jevLatencyMs = gate.latencyMs;
		metrics.jevCostUsd = gate.usage.costUsd;
		const retained = [];
		let droppedTokens = 0;
		for (const [index, chunk] of chunks.entries()) {
			const decision = gate.decisions[chunk.id];
			if (!decision) throw new Error(`Jev returned no decision for ${chunk.id}`);
			await emit({
				type: "jev.evaluation",
				chunkId: chunk.id,
				sourceUrl: chunk.sourceUrl,
				label: chunk.label,
				decision: decision.decision,
				score: decision.score
			});
			if (decision.decision === "drop") droppedTokens += chunk.tokens;
			else retained.push(chunk);
			if (index % 5 === 4) await emit({
				type: "jev.progress",
				processed: index + 1,
				total: chunks.length
			});
		}
		metrics.retainedTokens = retained.reduce((sum, c) => sum + c.tokens, 0);
		await emit({
			type: "jev.complete",
			retainedTokens: metrics.retainedTokens,
			droppedTokens,
			latencyMs: gate.latencyMs,
			costUsd: gate.usage.costUsd
		});
		if (retained.length === 0) throw new Error("Jev retained nothing from these sources");
		const withTallies = sources.map((source) => ({
			...source,
			chunksKept: retained.filter((c) => c.sourceUrl === source.url).length,
			retainedTokens: retained.filter((c) => c.sourceUrl === source.url).reduce((sum, c) => sum + c.tokens, 0)
		}));
		await patchRecord(buildId, {
			sources: withTallies,
			metrics
		});
		await patchRecord(buildId, { status: "synthesizing" });
		await emit({ type: "synthesis.started" });
		const { markdown, usage } = await synthesize({
			title: `${record.title} Knowledge Base`,
			purpose: record.purpose,
			retained,
			sources: withTallies.flatMap((s) => s.error ? [] : [{
				url: s.url,
				title: s.title ?? s.url
			}])
		});
		metrics.llmCalls = 1;
		metrics.synthesisInputTokens = usage.inputTokens;
		metrics.synthesisOutputTokens = usage.outputTokens;
		metrics.llmCostUsd = usage.costUsd;
		for (const heading of markdown.split("\n").filter((line) => line.startsWith("## "))) await emit({
			type: "synthesis.section",
			title: heading.slice(3).trim(),
			sourceChunkIds: retained.map((c) => c.id)
		});
		await emit({
			type: "synthesis.complete",
			outputTokens: estimateTokens(markdown),
			costUsd: usage.costUsd
		});
		await patchRecord(buildId, { status: "creating_kb" });
		const { id: knowledgeBaseId } = await sanityKnowledgeBaseProvider.create({
			title: `${record.title} Knowledge Base`,
			purpose: record.purpose
		});
		await patchRecord(buildId, { sanityKnowledgeBaseId: knowledgeBaseId });
		await emit({
			type: "sanity.kb.created",
			knowledgeBaseId
		});
		await emit({ type: "sanity.kb.importing" });
		await sanityKnowledgeBaseProvider.importMarkdown({
			knowledgeBaseId,
			title: `${record.title} Knowledge Base`,
			markdown
		});
		await patchRecord(buildId, { status: "building_kb" });
		await sanityKnowledgeBaseProvider.build({ knowledgeBaseId });
		let lastStage;
		for (let i = 0; i < 60; i++) {
			await new Promise((resolve) => setTimeout(resolve, 1e4));
			const status = await sanityKnowledgeBaseProvider.status({ knowledgeBaseId });
			if (status.stage !== lastStage) {
				lastStage = status.stage;
				await emit({
					type: "sanity.kb.building",
					stage: status.stage
				});
			}
			if (!status.isBuilding && status.state !== "building") break;
		}
		metrics.elapsedMs = Date.now() - started;
		metrics.estimatedCostUsd = (metrics.jevCostUsd ?? 0) + (metrics.llmCostUsd ?? 0);
		await patchRecord(buildId, {
			status: "ready",
			metrics
		});
		await emit({ type: "sanity.kb.ready" });
		await enforceRetention();
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		metrics.elapsedMs = Date.now() - started;
		await patchRecord(buildId, {
			status: "failed",
			error: message,
			metrics
		});
		await emit({
			type: "build.failed",
			message
		});
		throw error;
	}
}
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
export { enforceRetention, runBuild };

//# sourceMappingURL=index12.js.map