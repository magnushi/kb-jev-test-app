//#region lib/ingestion/chunk.ts
/** ~4 characters per token. Good enough for budgeting; never shown as a measured figure. */
function estimateTokens(text) {
	return Math.ceil(text.length / 4);
}
/**
* Paragraph-aware chunking into bounded windows. Paragraph boundaries are kept so a
* chunk reads as a coherent unit — Jev judges it in isolation.
*/
function chunkText(text, sourceUrl, sourceIndex, { targetTokens = 400, maxTokens = 700 } = {}) {
	const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);
	const chunks = [];
	let buffer = [];
	let bufferTokens = 0;
	const flush = () => {
		if (buffer.length === 0) return;
		const body = buffer.join("\n");
		chunks.push({
			id: `s${sourceIndex}c${chunks.length}`,
			text: body,
			tokens: estimateTokens(body),
			sourceUrl,
			label: labelFor(body)
		});
		buffer = [];
		bufferTokens = 0;
	};
	for (const paragraph of paragraphs) {
		const tokens = estimateTokens(paragraph);
		if (tokens > maxTokens) {
			flush();
			for (let i = 0; i < paragraph.length; i += maxTokens * 4) {
				const slice = paragraph.slice(i, i + maxTokens * 4);
				chunks.push({
					id: `s${sourceIndex}c${chunks.length}`,
					text: slice,
					tokens: estimateTokens(slice),
					sourceUrl,
					label: labelFor(slice)
				});
			}
			continue;
		}
		if (bufferTokens + tokens > targetTokens) flush();
		buffer.push(paragraph);
		bufferTokens += tokens;
	}
	flush();
	return chunks;
}
/** Short human label for the knowledge map tooltip (design brief §6.1). */
function labelFor(text) {
	const words = (text.split("\n")[0] ?? text).split(/\s+/).slice(0, 8).join(" ");
	return words.length > 72 ? `${words.slice(0, 69)}…` : words;
}
//#endregion
export { chunkText, estimateTokens };

//# sourceMappingURL=index5.js.map