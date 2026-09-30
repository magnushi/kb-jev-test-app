import { config } from "./index2.js";
//#region lib/providers/jev/index.ts
var QUESTION = "Does `candidate_text` contain information worth retaining for this knowledge base? Answer yes for substantive facts, definitions, procedures, caveats and terminology. Answer no for navigation, boilerplate, cookie notices, newsletter prompts, legal footers and marketing filler.";
function classify(score) {
	if (score >= config.relevance.keepAbove) return "keep";
	if (score < config.relevance.dropBelow) return "drop";
	return "uncertain";
}
async function callJev(body, attempt = 0) {
	const res = await fetch(config.jev.baseUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.jev.apiKey}`,
			"Content-Type": "application/json"
		},
		body: JSON.stringify(body)
	});
	if (res.status === 429 || res.status === 529) {
		if (attempt >= 4) throw new Error(`Jev overloaded after ${attempt} retries (${res.status})`);
		await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
		return callJev(body, attempt + 1);
	}
	if (!res.ok) throw new Error(`Jev ${res.status}: ${(await res.text()).slice(0, 300)}`);
	return await res.json();
}
/**
* Jev processes `state` once and evaluates every question against it in parallel,
* so one request carries the purpose plus many chunks. See docs/integration-notes.md §1.
*/
var jevRelevanceGate = { async evaluate({ purpose, topic, chunks }) {
	const started = Date.now();
	const decisions = {};
	const usage = {
		inputTokens: 0,
		outputTokens: 0
	};
	const size = config.budgets.maxChunksPerJevCall;
	for (let i = 0; i < chunks.length; i += size) {
		const batch = chunks.slice(i, i + size);
		const questions = Object.fromEntries(batch.map((c) => [`keep_${c.id}`, {
			type: "noul",
			instructions: {
				candidate_text: c.text,
				question: QUESTION
			}
		}]));
		const res = await callJev({
			model: config.jev.model,
			state: `Knowledge base purpose: ${purpose}\nTopic: ${topic}`,
			questions
		});
		for (const c of batch) {
			const answer = res.answers[`keep_${c.id}`];
			if (!answer) throw new Error(`Jev returned no answer for chunk ${c.id}`);
			decisions[c.id] = {
				score: answer.noul,
				decision: classify(answer.noul)
			};
		}
		usage.inputTokens += res.usage.input_tokens;
		usage.outputTokens += res.usage.output_tokens;
	}
	usage.costUsd = usage.inputTokens / 1e6 * .042;
	return {
		decisions,
		usage,
		latencyMs: Date.now() - started
	};
} };
//#endregion
export { jevRelevanceGate };

//# sourceMappingURL=index6.js.map