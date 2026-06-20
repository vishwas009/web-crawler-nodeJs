import { argv } from "node:process";
import { type ExtractedPageData } from "./crawl.js";
import ConcurrentCrawler from "./concurrent_crawler.js";
import { writeJSONReport } from "./report.js";

async function crawlSiteAsync(
  baseUrl: string,
  maxConcurrency: number,
  maxPages: number = 100,
): Promise<Record<string, ExtractedPageData>> {
  const crawler = new ConcurrentCrawler(baseUrl, maxConcurrency, maxPages);
  return await crawler.crawl();
}

async function main() {
  if (argv.length < 3) {
    console.error(
      "Usage: node index.js <base_url> <max_concurrency> [max_pages]",
    );
    process.exit(1);
  }

  const url = argv[2];
  const maxConcurrency = argv[3] ? parseInt(argv[3], 10) : 1;
  const maxPages = argv[4] ? parseInt(argv[4], 10) : 100;

  if (isNaN(maxConcurrency) || isNaN(maxPages)) {
    console.error("Invalid arguments for maxConcurrency or maxPages.");
    process.exit(1);
  }

  try {
    const pages = await crawlSiteAsync(url, maxConcurrency, maxPages);
    writeJSONReport(pages, url);

    console.log('Crawling finished generated JSON report');
    process.exit(0);
  } catch (error) {
    console.error("Error occurred while crawling the site:", error);
    process.exit(1);
  }
}

await main();
