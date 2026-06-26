import path from "node:path";
import fs from 'node:fs'
import readline from 'readline'
import pLimit from "p-limit";
import { TimeoutError, type Browser, type Page, type HTTPResponse} from 'puppeteer'
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { normalizeURL, extractPageData, type ExtractedPageData } from "./crawl.js";
import crawler_config from '../config.json' with {type: 'json'};
import { writeJSONReport_One } from "./report.js";

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
  private config: Record<string, any> = {};
  private dirPath: string;

  constructor(baseUrl: string, maxConcurrency: number, maxPages: number = 100) {
    this.baseUrl = baseUrl;
    this.baseHost = new URL(baseUrl).hostname;
    this.dirPath = path.resolve(process.cwd(), 'reports', `${this.baseHost}_${Date.now()}`);
    this.maxPages = maxPages;
    // this.maxConcurrency = maxConcurrency;
    this.limit = pLimit(maxConcurrency);
    this.config = crawler_config;

    puppeteer.use(StealthPlugin());
  }

  private addPageVisit(normalizedURL: string): boolean {
    if (this.shouldStop) {
      return false;
    }

    if (this.visitedURLs.size >= this.maxPages) {
      this.shouldStop = true;
      // console.log(`Reached max page limit of ${this.maxPages}. Stopping crawl.`,);
      return false;
    }

    if (this.visitedURLs.has(normalizedURL)) {
      return false;
    }

    this.visitedURLs.add(normalizedURL);
    return true;
  }

  private async saveImage(
    response: HTTPResponse,
    dir_path: string,
  ): Promise<void> {
    try {
      const buffer = await response.buffer();
      if (this.config.IGNORE_SMALL_IMAGES === true && buffer.length <= this.config.SMALL_IMAGE_SIZE) {
        return;
      }

      const url = response.url();
      const parsedUrl = new URL(url);
      let fileName = path.basename(parsedUrl.pathname);

      // Fallback name if the pathname doesn't have an explicit file extension
      if (!fileName || !fileName.includes(".")) {
        const contentType = response.headers()["content-type"] || "";
        const ext = contentType.split("/")[1] || "jpg";
        fileName = `captured_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
      } else {
        fileName = `${Math.trunc(Math.random() * 10000000)}_${fileName}`;
      }

      const filePath = path.join(dir_path, fileName);
      await fs.promises.writeFile(filePath, buffer);

      console.log(`Saved ${fileName}`);
    } catch (err) {
      console.log(err instanceof Error ? err.message : err);
    }
  }

  private async scrollPage(page: Page, times: number): Promise<unknown> {
    return page.evaluate((s_times) => {
      return new Promise((resolve: any) => {
        const max_scrolls = s_times;
        let scrollTimes = 0;
        let totalHeight = 0;
        const distance = 300; // Pixels per scroll step
        let retry = 4;

        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          const scrollHeight = document.body.scrollHeight;
          totalHeight += distance;
          scrollTimes++;

          // console.log(`Scroll: ${scrollTimes} T_H: ${totalHeight} DF: ${scrollHeight - window.innerHeight}`,);

          // Stop when we reach the absolute bottom of the page or scroll limit reached
          if (totalHeight >= scrollHeight - window.innerHeight || scrollTimes > max_scrolls) {
            if(scrollTimes <= max_scrolls && retry > 0) {
              totalHeight -= distance;
              retry--;
            } else {
              clearInterval(timer);
              resolve();
            }
          }
        }, 500);

        // let previousHeight = 0;

        // const timer = setInterval(() => {
        //   const currentHeight = document.body.scrollHeight;
        //   scrollTimes++;

        //   window.scrollTo(0, currentHeight);

        //   if (currentHeight === previousHeight || scrollTimes >= 4) {
        //     clearInterval(timer);
        //     resolve();
        //   }

        //   previousHeight = currentHeight;
        // }, 3 * 1000);
      });
    }, times);
  }

  private async waitForKeyPress() {
    // Allow Node.js to emit keypress events on process.stdin
    readline.emitKeypressEvents(process.stdin);

    // Enter raw mode to capture individual keystrokes instead of whole lines
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    return new Promise((resolve) => {
      process.stdin.once("keypress", (chunk, key) => {
        // Restore standard behavior so the terminal behaves normally after
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }

        // Explicitly pause stdin so the Node.js process can exit cleanly later
        process.stdin.pause();

        resolve(key);
      });
    });
  }

  private async scrape(url: string, output_dir: string, retries: number = 2): Promise<string> {
    let html = "";
    const blockedTypes = new Set([
      /*"image",*/
      "media",
      "font",
      /*'stylesheet'*/
    ]);
    const OUTPUT_DIR = path.resolve(output_dir, "images");
    await fs.promises.mkdir(OUTPUT_DIR, {recursive: true});
    const imageTasks = new Set<Promise<void>>();

    console.log(`Crawling: ${url}`);

    for (let i = 0; i <= retries; i++) {
      let page: Page | null = null;

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

        page.on("response", (response) => {
          const request = response.request();

          if (request.resourceType() === "image" && this.config.SAVE_IMAGES === true) {
            const task = this.saveImage(response, OUTPUT_DIR);

            imageTasks.add(task);
            task.finally(() => imageTasks.delete(task));
          }
        });

        page.on("requestfailed", (request: any) => {
          if (request.resourceType() === "document") {
            console.log("FAILED:", request.url(), request.failure()?.errorText);
          }
        });

        try {
          const pageResponse = await page.goto(url, {
            waitUntil: ["load"],
            timeout: this.config.DEFAULT_TIMEOUT,
          });

          if (pageResponse?.status() === 429) {
            throw new Error("Rate Limited");
          }
        } catch (err) {
          if (err instanceof Error && (err instanceof TimeoutError || err.name === "TimeoutError")) {
            console.log("Navigation timeout, continuing.");
            await page.evaluate(() => window.stop());
          } else {
            throw err;
          }
        }

        if(this.config.HEADLESS === false) {
          console.log("Waiting for user input");
          page.evaluate(() => {
            alert('Page Launched in Headfull mode, press a key in terminal when done to continue crawling.');
          });
          const key = await this.waitForKeyPress();
          console.log("Continuing Crawling");
        }


        try {
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: this.config.DEFAULT_TIMEOUT });
        } catch (error) {
          if (error instanceof Error && (error instanceof TimeoutError || error.name === "TimeoutError")) {
            console.log("waitForNetworkIdle timeout, continuing.");
          } else {
            throw error;
          }
        }

        html = await page.content();

        if (html) {
          break;
        } else {
          throw new Error("No HTML");
        }
      } catch (error) {
        console.log("Final Catch block");
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        console.log(
          `Attempt ${i + 1}/${retries + 1} failed for ${url}\n Error: ${error instanceof Error ? error.message : error}`,
        );
      } finally {
        if (page) {
          console.log(`Waiting for all tasks to complete. Pending: ${imageTasks.size}`);

          const timeout = new Promise((resolve) =>
            setTimeout(() => {
              console.log("Timeout Rejecting rest pending tasks");
              resolve();
            }, this.config.ALL_TASKS_TIMEOUT),
          );

          await Promise.race([
            timeout,
            Promise.allSettled(Array.from(imageTasks)),
          ]);

          console.log("All tasks completed");

          await page.close();
          page = null;
        }
      }
    }

    return html;
  }

  private async crawlPage(baseURL: string, currentURL: string = baseURL): Promise<void> {
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

    console.log(`Url added to queue: ${currentURL}`);

    const output_dir = path.resolve(this.dirPath, urlObj.pathname.replaceAll('/', '_'));
    const html = await this.limit(async () => {
      await fs.promises.mkdir(output_dir, {recursive: true});
      return this.scrape(currentURL, output_dir);
    });

    if (html) {
      const pageData = extractPageData(html, currentURL);
      writeJSONReport_One(pageData, output_dir);
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
        headless: this.config.HEADLESS,
        // userDataDir: './profile'
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Prevents issues with small /dev/shm memory limits
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });

      await fs.promises.mkdir(this.dirPath, { recursive: true });
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
