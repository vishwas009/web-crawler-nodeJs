import path from "node:path";
import fs from "node:fs";

import { type ExtractedPageData } from "../types.js";

export function writeJSONReport(pageData: Record<string, ExtractedPageData>, url: string): void {
    const urlObj = new URL(url);
    const sorted = Object.values(pageData).sort((a, b) => a.url.localeCompare(b.url));
    const filename = path.resolve(process.cwd(), 'reports', urlObj.hostname + `_${Date.now()}.json`);

    fs.writeFileSync(
        filename, 
        JSON.stringify(sorted, null, 2)
    );
}

export function writeJSONReport_One(pageData: ExtractedPageData, dir_path: string): void {
    const filename = path.resolve(dir_path, 'report.json');

    fs.writeFileSync(
        filename, 
        JSON.stringify(pageData, null, 2)
    );
}
