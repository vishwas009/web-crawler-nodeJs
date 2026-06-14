import path from "node:path";
import fs from "node:fs";

import { type ExtractedPageData } from "./crawl.js";

export function writeJSONReport(pageData: Record<string, ExtractedPageData>, filename = "report.json"): void {
    const sorted = Object.values(pageData).sort((a, b) => a.url.localeCompare(b.url));
    
    fs.writeFileSync(
        path.resolve(process.cwd(), filename), 
        JSON.stringify(sorted, null, 2)
    );
}
