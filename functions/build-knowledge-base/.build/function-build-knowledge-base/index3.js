import { config } from "./index2.js";
import dns from "node:dns/promises";
import net from "node:net";
//#region lib/ingestion/fetch.ts
var ALLOWED_PROTOCOLS = /* @__PURE__ */ new Set(["http:", "https:"]);
/** Blocks private, loopback, link-local and unique-local ranges. */
function isPrivateAddress(ip) {
	if (net.isIPv4(ip)) {
		const [a = 0, b = 0] = ip.split(".").map(Number);
		if (a === 10 || a === 127 || a === 0) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 169 && b === 254) return true;
		if (a === 100 && b >= 64 && b <= 127) return true;
		return false;
	}
	const lower = ip.toLowerCase();
	return lower === "::1" || lower === "::" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
}
async function assertPublicUrl(raw) {
	let url;
	try {
		url = new URL(raw);
	} catch {
		throw new Error(`Not a valid URL: ${raw}`);
	}
	if (!ALLOWED_PROTOCOLS.has(url.protocol)) throw new Error(`Blocked protocol: ${url.protocol}`);
	if (!url.hostname.includes(".")) throw new Error(`Blocked hostname: ${url.hostname}`);
	const records = await dns.lookup(url.hostname, { all: true }).catch(() => []);
	if (records.length === 0) throw new Error(`Could not resolve ${url.hostname}`);
	for (const { address } of records) if (isPrivateAddress(address)) throw new Error(`Blocked private address for ${url.hostname}`);
	return url;
}
async function fetchPage(raw) {
	const url = await assertPublicUrl(raw);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), config.budgets.fetchTimeoutMs);
	try {
		const res = await fetch(url, {
			signal: controller.signal,
			redirect: "follow",
			headers: { "User-Agent": "KnowledgeBaseLab/0.1 (+https://github.com/magnushi/kb-jev-test-app)" }
		});
		if (!res.ok) throw new Error(`Fetch ${res.status} for ${url.href}`);
		const contentType = res.headers.get("content-type") ?? "";
		if (!contentType.includes("text/html") && !contentType.includes("text/plain")) throw new Error(`Unsupported content-type "${contentType}" for ${url.href}`);
		const declared = Number(res.headers.get("content-length") ?? 0);
		if (declared > config.budgets.maxFetchedBytes) throw new Error(`Response too large (${declared} bytes) for ${url.href}`);
		const html = (await res.text()).slice(0, config.budgets.maxFetchedBytes);
		const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? url.hostname;
		return {
			url: url.href,
			title: decodeEntities(title),
			html,
			bytes: Buffer.byteLength(html)
		};
	} finally {
		clearTimeout(timer);
	}
}
function decodeEntities(text) {
	return text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}
//#endregion
export { assertPublicUrl, decodeEntities, fetchPage };

//# sourceMappingURL=index3.js.map