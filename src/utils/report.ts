import path from "node:path";
import fs from "node:fs";

// Implement seprate reports in future //
export function writeJSONReport(pageData: Record<string, any>, dir_path: string): void {
    const filename = path.resolve(dir_path, 'report.json');

    fs.writeFileSync(
        filename, 
        JSON.stringify(pageData, null, 2)
    );
}
