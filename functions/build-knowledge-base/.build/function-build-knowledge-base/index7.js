import { config } from "./index2.js";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
//#region lib/ingestion/synthesize.ts
var client = new Anthropic({ apiKey: config.llm.apiKey });
var SYSTEM_PROMPT = fs.readFileSync(path.join(process.cwd(), "prompts", "synthesize-final.md"), "utf8");
async function synthesize(input) {
	const grouped = /* @__PURE__ */ new Map();
	for (const chunk of input.retained) {
		const list = grouped.get(chunk.sourceUrl) ?? [];
		list.push(chunk);
		grouped.set(chunk.sourceUrl, list);
	}
	const material = [...grouped.entries()].map(([url, chunks]) => {
		return `## Source: ${input.sources.find((s) => s.url === url)?.title ?? url}\nURL: ${url}\n\n${chunks.map((c) => c.text).join("\n\n")}`;
	}).join("\n\n---\n\n");
	const message = await client.messages.create({
		model: config.llm.synthesisModel,
		max_tokens: config.budgets.maxSynthesisOutputTokens,
		thinking: { type: "adaptive" },
		system: SYSTEM_PROMPT,
		messages: [{
			role: "user",
			content: `Knowledge base title: ${input.title}\nPurpose: ${input.purpose}\nOutput budget: ${config.budgets.maxSynthesisOutputTokens} tokens.\n\nRetained source material follows.\n\n${material}`
		}]
	});
	if (message.stop_reason === "refusal") throw new Error("Synthesis refused by the model");
	const markdown = message.content.filter((block) => block.type === "text").map((block) => block.text).join("").trim();
	if (!markdown) throw new Error("Synthesis produced no text");
	return {
		markdown,
		usage: {
			inputTokens: message.usage.input_tokens,
			outputTokens: message.usage.output_tokens,
			costUsd: message.usage.input_tokens / 1e6 * 5 + message.usage.output_tokens / 1e6 * 25
		}
	};
}
//#endregion
export { synthesize };

//# sourceMappingURL=index7.js.map