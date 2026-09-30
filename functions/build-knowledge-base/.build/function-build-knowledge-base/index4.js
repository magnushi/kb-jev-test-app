import { decodeEntities } from "./index3.js";
import { Readability, isProbablyReaderable } from "@mozilla/readability";
import { parseHTML } from "linkedom";
//#region lib/ingestion/extract.ts
var STRIP_BLOCKS = /<(script|style|noscript|svg|nav|header|footer|aside|form)\b[^>]*>[\s\S]*?<\/\1>/gi;
var BLOCK_BOUNDARY = /<\/(p|div|section|article|li|h[1-6]|tr|blockquote|pre)\s*>/gi;
/**
* Main-content extraction with Mozilla Readability — the same algorithm Firefox
* Reader Mode uses. It scores candidate containers by text and link density, which
* a regex cannot do, and keeps sidebars and reference navigation out of the body.
*
* Falls back to tag-stripping when Readability declines a page (some app shells and
* very short documents), so extraction never returns nothing on a page we fetched.
*/
function extractReadableText(html, url) {
	try {
		const { document } = parseHTML(html);
		if (url) {
			const base = document.createElement("base");
			base.setAttribute("href", url);
			document.head?.appendChild(base);
		}
		if (isProbablyReaderable(document)) {
			const article = new Readability(document, { charThreshold: 250 }).parse();
			const content = article?.content;
			if (content && content.length > 400) {
				const text = flattenHtml(content);
				if (text.length > 400) return {
					text,
					title: article?.title ?? void 0,
					method: "readability"
				};
			}
		}
	} catch {}
	return {
		text: fallbackExtract(html),
		method: "fallback"
	};
}
/** Flatten HTML to text, keeping block boundaries as newlines. */
function flattenHtml(html) {
	return normalize(decodeEntities(html.replace(STRIP_BLOCKS, " ").replace(BLOCK_BOUNDARY, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")));
}
function fallbackExtract(html) {
	let working = html.replace(STRIP_BLOCKS, " ");
	const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(working)?.[1] ?? /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(working)?.[1];
	if (main && main.length > 500) working = main;
	return flattenHtml(working);
}
function normalize(text) {
	return text.replace(/[ \t ]+/g, " ").split("\n").map((line) => line.trim()).filter((line) => line.length > 0).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
//#endregion
export { extractReadableText };

//# sourceMappingURL=index4.js.map