import { config } from "./index2.js";
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
new Anthropic({ apiKey: config.llm.apiKey });
fs.readFileSync(path.join(process.cwd(), "prompts", "synthesize-final.md"), "utf8");
//#endregion
export {};

//# sourceMappingURL=index10.js.map