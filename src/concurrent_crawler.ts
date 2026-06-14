import pLimit, { LimitFunction } from "p-limit";
import { normalizeURL, getURLsFromHTML, extractPageData, type ExtractedPageData } from "./crawl.js";

export default class ConcurrentCrawler {
  private baseUrl: string;
  private maxConcurrency: number;
  private maxPages: number = 100;
  private shouldStop: boolean = false;
  private limit: LimitFunction;
  private pages: Record<string, ExtractedPageData> = {};
  private allTasks: Set<Promise<void>> = new Set();
  private visitedURLs: Set<string> = new Set();

  constructor(baseUrl: string, maxConcurrency: number, maxPages: number = 100) {
    this.baseUrl = baseUrl;
    this.maxPages = maxPages;
    this.maxConcurrency = maxConcurrency;
    this.limit = pLimit(maxConcurrency);
  }

  private addPageVisit(normalizedURL: string): boolean {
    if(this.shouldStop) {
      return false;
    }

    if(this.visitedURLs.size >= this.maxPages) {
      this.shouldStop = true;
      console.log(`Reached max page limit of ${this.maxPages}. Stopping crawl.`);
      return false;
    }

    if (this.visitedURLs.has(normalizedURL)) {
      return false;
    }

    this.visitedURLs.add(normalizedURL);
    return true;
  }

  private async getHTML(url: string): Promise<string> {
    return await this.limit(async () => {
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "BootCrawler/1.0" },
        });

        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("text/html")) {
            console.log(`Got non-HTML response: ${contentType}`);
            return "";
          }

          return await response.text();
        } else {
          console.error(
            `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          );
          return "";
        }
      } catch (error) {
        console.error(`Error fetching HTML for ${url}:`, error);
        return "";
      }
    });
  }

  private async crawlPage(baseURL: string, currentURL: string = baseURL): Promise<void> {
    if(this.shouldStop) {
      return;
    }

    const urlObj = new URL(currentURL);
    if(urlObj.hostname !== new URL(baseURL).hostname) {
      return;
    }
  
    const normalizedURL = normalizeURL(currentURL);
    if(!this.addPageVisit(normalizedURL)) {
      return;
    }
  
    console.log(`Crawling: ${currentURL}`);
  
    const html = await this.getHTML(currentURL);
    if(html) {
      const pageData = extractPageData(html, currentURL);
      this.pages[normalizedURL] = pageData;
      const urls = pageData.outgoing_links;
      const crawlPromises : Promise<void>[] = [];

      for(const url of urls) {
        if(this.shouldStop) break;

        const task = this.crawlPage(baseURL, url);
        this.allTasks.add(task);
        task.finally(() => this.allTasks.delete(task));
        crawlPromises.push(task);
      }

      await Promise.all(crawlPromises);
    }
  }

  async crawl(): Promise<Record<string, ExtractedPageData>> {
    const rootTask = this.crawlPage(this.baseUrl);
    this.allTasks.add(rootTask);

    try {
      await rootTask;
    } finally {
      this.allTasks.delete(rootTask);
    }

    await Promise.allSettled(Array.from(this.allTasks));
    return this.pages;
  }
}
