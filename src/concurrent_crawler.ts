import pLimit from "p-limit";
import {TimeoutError, type Browser, type Page} from 'puppeteer'
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { normalizeURL, getURLsFromHTML, extractPageData, type ExtractedPageData } from "./crawl.js";

export default class ConcurrentCrawler {
  private baseUrl: string;
  private baseHost: string;
  // private maxConcurrency: number;
  private maxPages: number = 100;
  private shouldStop: boolean = false;
  private limit: ReturnType<typeof pLimit>;
  private pages: Record<string, ExtractedPageData> = {};
  private allTasks: Set<Promise<void>> = new Set();
  private visitedURLs: Set<string> = new Set();
  private browser: Browser | null = null;

  constructor(baseUrl: string, maxConcurrency: number, maxPages: number = 100) {
    this.baseUrl = baseUrl;
    this.baseHost = new URL(baseUrl).hostname;
    this.maxPages = maxPages;
    // this.maxConcurrency = maxConcurrency;
    this.limit = pLimit(maxConcurrency);

    puppeteer.use(StealthPlugin());
  }

  private addPageVisit(normalizedURL: string): boolean {
    if (this.shouldStop) {
      return false;
    }

    if (this.visitedURLs.size >= this.maxPages) {
      this.shouldStop = true;
      console.log(`Reached max page limit of ${this.maxPages}. Stopping crawl.`,);
      return false;
    }

    if (this.visitedURLs.has(normalizedURL)) {
      return false;
    }

    this.visitedURLs.add(normalizedURL);
    return true;
  }

  // private async getHTML(url: string): Promise<string> {
  //   return await this.limit(async () => {
  //     try {
  //       const response = await fetch(url, {
  //         headers: { "User-Agent": "BootCrawler/1.0" },
  //       });

  //       if (response.ok) {
  //         const contentType = response.headers.get("content-type");
  //         if (!contentType || !contentType.includes("text/html")) {
  //           console.log(`Got non-HTML response: ${contentType}`);
  //           return "";
  //         }

  //         return await response.text();
  //       } else {
  //         console.error(
  //           `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
  //         );
  //         return "";
  //       }
  //     } catch (error) {
  //       console.error(`Error fetching HTML for ${url}:`, error);
  //       return "";
  //     }
  //   });
  // }

  private async scrape(url: string, retries: number = 2): Promise<string> {
    let html = '';
    let page: Page | null = null;
    const blockedTypes = new Set([
      "image",
      "media",
      "font" 
      /*'stylesheet'*/
    ]);

    console.log(`Crawling: ${url}`);

    for (let i = 0; i <= retries; i++) {
      try {
        page = await this.browser!.newPage();
        await page.setRequestInterception(true);

        page.on("request", (request: any) => {
          if (blockedTypes.has(request.resourceType())) {
            request.abort();
          } else {
            request.continue();
          }
        });

        // page.on("response", async (response: any) => {
        //   const url = response.url();
        //   const request = response.request();

        //   if (request.resourceType() === "image") {
        //     console.log("Successfully intercepted image");
        //   }
        // });

        // page.on("response", async (response: any) => {
        //   if (response.status() === 429) {
        //     console.log(response.status(), response.url());
        //   }
        // });

        page.on("requestfailed", (request: any) => {
          if(request.resourceType() === "document") {
            console.log("FAILED:", request.url(), request.failure()?.errorText);
          }
        });

        const pageResponse = await page.goto(url, {
          waitUntil: ["load"],
          timeout: 60 * 1000,
        });

        if (pageResponse?.status() === 429) {
          throw new Error('Rate Limited');
        }

        // await page.evaluate(() => {
        //   return new Promise((resolve: any) => {
        //     let scrollTimes = 0;
        //     let totalHeight = 0;
        //     const distance = 100; // Pixels per scroll step

        //     const timer = setInterval(() => {
        //       const scrollHeight = document.body.scrollHeight;
        //       window.scrollBy(0, distance);
        //       totalHeight += distance;
        //       scrollTimes++;

        //       // Stop when we reach the absolute bottom of the page or scroll limit reached
        //       if (totalHeight >= scrollHeight - window.innerHeight || scrollTimes > 100) {
        //         clearInterval(timer);
        //         resolve();
        //       }
        //     }, 300);
        //   });
        // });

        
        

        try {
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: 60000 });
        } catch (error) {
          if (!(error instanceof TimeoutError)) {
            throw error;
          }
        }

        html = await page.content();

        if (html) {
          break;
        } else {
          throw new Error('No HTML');
        }
      } catch (error) {
        if(i < retries) {
          await new Promise(
            resolve => setTimeout(resolve, 5000)
          );
        }

        console.log(`Attempt ${i + 1}/${retries + 1} failed for ${url}\n Error: ${error instanceof Error ? error.message : error}`);
      } finally {
        if(page) {
          await page.close();
          page = null;
        }
      }
    }

    return html;
  }

  private async crawlPage(
    baseURL: string,
    currentURL: string = baseURL,
  ): Promise<void> {
    if (this.shouldStop) {
      return;
    }

    const urlObj = new URL(currentURL);
    if (urlObj.hostname !== this.baseHost) {
      return;
    }

    const normalizedURL = normalizeURL(currentURL);
    if (!this.addPageVisit(normalizedURL)) {
      return;
    }

    const html = await this.limit(() => {
      return this.scrape(currentURL);
    });

    if (html) {
      const pageData = extractPageData(html, currentURL);
      this.pages[normalizedURL] = pageData;
      const urls = pageData.outgoing_links;
      const crawlPromises: Promise<void>[] = [];

      for (const url of urls) {
        if (this.shouldStop) break;

        const task = this.crawlPage(baseURL, url);
        this.allTasks.add(task);
        task.finally(() => this.allTasks.delete(task));
        crawlPromises.push(task);
      }

      await Promise.all(crawlPromises);
    }
  }

  async crawl(): Promise<Record<string, ExtractedPageData>> {
    let rootTask: Promise<void> | undefined;

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        // userDataDir: './profile'
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Prevents issues with small /dev/shm memory limits
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });

      rootTask = this.crawlPage(this.baseUrl);
      this.allTasks.add(rootTask);

      await rootTask;
      await Promise.allSettled(Array.from(this.allTasks));
    } catch (error) {
      console.error("Error occurred while crawling the site:", error);
    } finally {
      if (rootTask) {
        this.allTasks.delete(rootTask);
      }

      if (this.browser) {
        await this.browser.close();
      }
    }

    return this.pages;
  }
}
