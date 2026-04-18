import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const globalsPath = join(process.cwd(), "node_modules", "@types", "node", "globals.d.ts");

if (!existsSync(globalsPath)) {
  console.log("[patch-node-types] Skipped: @types/node globals.d.ts not found.");
  process.exit(0);
}

const content = readFileSync(globalsPath, "utf8");

if (content.startsWith("// @ts-nocheck")) {
  console.log("[patch-node-types] Already patched.");
  process.exit(0);
}

writeFileSync(globalsPath, `// @ts-nocheck\n${content}`, "utf8");
console.log("[patch-node-types] Applied // @ts-nocheck to @types/node globals.d.ts");
