import path from "node:path";
import fs from 'node:fs'
import readline from 'readline'
import pLimit from "p-limit";
import { TimeoutError, type Browser, type Page, type HTTPResponse} from 'puppeteer'
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { PageCrawlResult, CrawlSummary } from "./types.js";
import { normalizeURL } from "./utils/crawl_utils.js";
import crawler_config from '../config.json' with {type: 'json'};
import { writeJSONReport } from "./utils/report.js";
import HtmlExtractor from "./extractors/HtmlExtractors/HtmlExtractor.js";
import RuntimeExtractor from "./extractors/RuntimeExtractors/RuntimeExtractor.js";
import ImageDownloadService from "./services/ImageDownloaderService.js";
import DiskStorage from "./services/storage/DiskStorage.js";

export default class ConcurrentCrawler {
  private baseUrl: string;
  private baseHost: string;
  // private maxConcurrency: number;
  private maxPages: number = 100;
  private shouldStop: boolean = false;
  private limit: ReturnType<typeof pLimit>;
  private visitedURLs: Set<string> = new Set();
  private browser: Browser | null = null;
  private config: Record<string, any> = {};
  private dirPath: string;
  private diskStorage: DiskStorage;
  private htmlExtractor: HtmlExtractor;
  private runtimeExtractor: RuntimeExtractor;

  constructor(baseUrl: string, maxConcurrency: number, maxPages: number = 100) {
    this.baseUrl = baseUrl;
    this.baseHost = new URL(baseUrl).hostname;
    this.dirPath = path.resolve(process.cwd(), 'reports', `${this.baseHost}_${Date.now()}`);
    this.maxPages = maxPages;
    // this.maxConcurrency = maxConcurrency;
    this.limit = pLimit(maxConcurrency);
    this.config = crawler_config;
    this.diskStorage = new DiskStorage();
    this.htmlExtractor = new HtmlExtractor();
    this.runtimeExtractor = new RuntimeExtractor();

    puppeteer.use(StealthPlugin());
  }

  private addPageVisit(normalizedURL: string): boolean {
    if (this.shouldStop) {
      return false;
    }

    if (this.visitedURLs.size >= this.maxPages) {
      this.shouldStop = true;
      return false;
    }

    if (this.visitedURLs.has(normalizedURL)) {
      return false;
    }

    this.visitedURLs.add(normalizedURL);
    return true;
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

  private async takeScreenshot(page: Page, output_dir: string): Promise<void> {
    await page.mouse.move(1, 1);

    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve())));

    await page.screenshot({path: path.resolve(output_dir, 'screenshot.png')});
  }

  private async scrape(url: string, output_dir: string, retries: number = 2): Promise<PageCrawlResult> {
    let html = "";
    let pageHtmlData = null;
    let pageRuntimeData = null;
    const tasksMap = new Map();
    const imageDownloader = new ImageDownloadService({ 
      minSizeKB: this.config.SMALL_IMAGE_SIZE_KB,
      timeout: 30000, // 30 seconds
    }, this.diskStorage);

    const blockedTypes = new Set([
      /*"image",*/
      "media",
      "font",
      /*'stylesheet'*/
    ]);
    let success = false;

    const OUTPUT_DIR = path.resolve(output_dir, "images");
    await fs.promises.mkdir(OUTPUT_DIR, {recursive: true});

    console.log('\x1b[32mCRAWLING: \x1b[0m', url);
    const start = performance.now();

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
            imageDownloader.handleResponse(response, {prefix: OUTPUT_DIR});
          }
        });

        // page.on("requestfailed", (request: any) => {
        //   if (request.resourceType() === "document") {
        //     console.log('\x1b[33mFAILED: \x1b[0m', request.url(), request.failure()?.errorText);
        //   }
        // });

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
            console.log('\x1b[33mTIMEOUT: \x1b[0m', 'NAVIGATION');
            
            try {
              await page.evaluate(() => window.stop());
            } catch {}
          } else {
            throw err;
          }
        }

        // if(this.config.HEADLESS === false) {
        //   console.log("Waiting for user input");
        //   page.evaluate(() => {
        //     alert('Page Launched in Headfull mode, press a key in terminal when done to continue crawling.');
        //   });
        //   const key = await this.waitForKeyPress();
        //   console.log("Continuing Crawling");
        // }


        try {
          await page.waitForNetworkIdle({ idleTime: 500, timeout: this.config.DEFAULT_TIMEOUT });
        } catch (error) {
          if (error instanceof Error && (error instanceof TimeoutError || error.name === "TimeoutError")) {
            console.log('\x1b[33mTIMEOUT: \x1b[0m', 'waitForNetworkIdle');
          } else {
            throw error;
          }
        }

        html = await page.content();

        if (html) {
          pageHtmlData = this.htmlExtractor.extract(html, url);
          pageRuntimeData = await this.runtimeExtractor.extract(page, url);

          const tasks: {key: string; promise: Promise<any>}[] = [
            {key: 'screenshot', promise: this.takeScreenshot(page, output_dir)},
            {key: 'imageDownloads', promise: imageDownloader.finish()} 
          ];

          const trackedPromises = tasks.map(({ key, promise }) =>
            promise.then(result => {
              tasksMap.set(key, result);
              return result;
            })
          );

          const timeout = new Promise((_, reject) =>
            setTimeout(() => {
              reject(new Error('\x1b[33mTIMEOUT: \x1b[0m Timeout Rejecting rest pending tasks'));
            }, this.config.ALL_TASKS_TIMEOUT),
          );

          try {
            console.log('\x1b[32mINFO: \x1b[0m', 'Waiting for all tasks to complete');

            await Promise.race([
              Promise.allSettled(trackedPromises),
              timeout,
            ]);

            console.log('\x1b[32mINFO: \x1b[0m', 'All Tasks Completed.');
          } catch (error) {
            console.log('\x1b[31mERROR: \x1b[0m', error instanceof Error ? error.message : error)
          }

          success = true;
          break;
        } else {
          throw new Error("No HTML");
        }
      } catch (error) {
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        console.log('\x1b[31mERROR: \x1b[0m',
          `ATTEMPT ${i + 1}/${retries + 1}: Failed for ${url}\n Error: ${error instanceof Error ? error.message : error}`,
        );
      } finally {
        if (page && !page.isClosed()) {
          try {
            page.removeAllListeners();
            await page.close({ runBeforeUnload: false });
          } catch (error) {
            console.log('\x1b[31mERROR: \x1b[0m', error instanceof Error ? error.message : error);
          }

          page = null;
        }
      }
    }

    const end = performance.now();
    console.log('\x1b[32mINFO: \x1b[0m', `Downloaded ${tasksMap.has('imageDownloads') ? tasksMap.get('imageDownloads').length : 0} images`);
    
    return {
      crawlable_urls: pageHtmlData?.crawlable_links || [],
      page_url: url,
      extracted_data: {
        pageHtmlData: pageHtmlData || {},
        pageRuntimeData: pageRuntimeData || {}
      },
      success,
      crawl_time: end - start
    };
  }

  private async crawlPage(baseURL: string): Promise<CrawlSummary> {
    let currentUrls: Set<string> = new Set();
    let p_success = 0;
    let pages_crawled = 0;
    let total_pages_time = 0;

    currentUrls.add(baseURL);
    const start = performance.now();

    while (currentUrls.size > 0) {
      let promises: Promise<PageCrawlResult>[] = [];

      for (const url of currentUrls) {
        if (this.shouldStop) break;

        const normalizedURL = normalizeURL(url);
        if (!this.addPageVisit(normalizedURL)) {
          continue;
        }

        console.log('\x1b[32mURL ADDED TO QUEUE: \x1b[0m', url);

        const urlObj = new URL(url);
        const output_dir = path.resolve(this.dirPath, urlObj.pathname.replaceAll("/", "_"));

        promises.push(
          this.limit(async () => {
            await fs.promises.mkdir(output_dir, { recursive: true });

            return this.scrape(url, output_dir);
          }),
        );
      }

      const res = await Promise.all(promises);
      currentUrls.clear();

      res.forEach(({ crawlable_urls, page_url, extracted_data, success, crawl_time }) => {
        const urlObj = new URL(page_url);
        pages_crawled++;
        p_success += (success === true) ? 1 : 0;
        total_pages_time += crawl_time;

        writeJSONReport(
          extracted_data,
          path.resolve(this.dirPath, urlObj.pathname.replaceAll("/", "_")),
        );

        if (!this.shouldStop) {
          crawlable_urls.forEach((url) => {
            if (!this.visitedURLs.has(normalizeURL(url))) {
              currentUrls.add(url);
            }
          });
        }
      });
    }

    const end = performance.now();

    return {
      pages_crawled,
      success: p_success,
      failed: pages_crawled - p_success,
      average_page_time: (total_pages_time / pages_crawled) / 1000,
      total_duration: (end - start) / 1000
    }
  }

  async crawl(): Promise<Record<string, any>> {
    let summary = {};

    try {
      this.browser = await puppeteer.launch({
        headless: this.config.HEADLESS,
        // userDataDir: './profile'
        defaultViewport: null,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Prevents issues with small /dev/shm memory limits
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
          "--window-size=1920,1080"
        ],
      });

      await fs.promises.mkdir(this.dirPath, { recursive: true });
      summary = await this.crawlPage(this.baseUrl);
    } catch (error) {
      console.log('\x1b[31mERROR: \x1b[0m', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return summary;
  }
}
