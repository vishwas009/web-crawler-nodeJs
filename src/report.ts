import path from "node:path";
import fs from "node:fs";

import { type ExtractedPageData } from "./crawl.js";

export function writeJSONReport(pageData: Record<string, ExtractedPageData>, url: string): void {
    const urlObj = new URL(url);
    const sorted = Object.values(pageData).sort((a, b) => a.url.localeCompare(b.url));
    const filename = path.resolve(process.cwd(), 'reports', urlObj.hostname + `_${Date.now()}.json`);

    fs.writeFileSync(
        filename, 
        JSON.stringify(sorted, null, 2)
    );
}
