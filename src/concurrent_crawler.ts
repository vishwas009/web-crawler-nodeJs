import path from "node:path";
import fs from 'node:fs'
import readline from 'readline'
import pLimit from "p-limit";
import { TimeoutError, type Browser, type Page, type HTTPResponse} from 'puppeteer'
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { ExtractedPageData, PageData } from "./types.js";
import { normalizeURL, extractPageData } from "./utils/crawl.js";
import crawler_config from '../config.json' with {type: 'json'};
import { writeJSONReport_One } from "./utils/report.js";
// import MetadataExtractor from "./extractors/MetadataExtractor.js";
// import ContentExtractor from "./extractors/ContentExtractor.js";
import LinkExtractor from "./extractors/HtmlExtractors/LinkExtractor.js";
// import StructuredDataExtractor from "./extractors/StructuredDataExtractor.js";
// import OpenGraphExtractor from "./extractors/OpenGraphExtractor.js";
// import ImageExtractor from "./extractors/ImageExtractor.js";
import PerformanceExtractor from "./extractors/RuntimeExtractors/PerformanceExtractor.js";
import ImageDownloadService from "./services/ImageDownloaderService.js";
import DiskStorage from "./services/storage/DiskStorage.js";

export default class ConcurrentCrawler {
  private baseUrl: string;
  private baseHost: string;
  // private maxConcurrency: number;
  private maxPages: number = 100;
  private shouldStop: boolean = false;
  private limit: ReturnType<typeof pLimit>;
  private pages: Record<string, ExtractedPageData> = {};
  private visitedURLs: Set<string> = new Set();
  private browser: Browser | null = null;
  private config: Record<string, any> = {};
  private dirPath: string;
  private imageDownloader: ImageDownloadService;
  private diskStorage: DiskStorage;

  constructor(baseUrl: string, maxConcurrency: number, maxPages: number = 100) {
    this.baseUrl = baseUrl;
    this.baseHost = new URL(baseUrl).hostname;
    this.dirPath = path.resolve(process.cwd(), 'reports', `${this.baseHost}_${Date.now()}`);
    this.maxPages = maxPages;
    // this.maxConcurrency = maxConcurrency;
    this.limit = pLimit(maxConcurrency);
    this.config = crawler_config;
    this.diskStorage = new DiskStorage();

    this.imageDownloader = new ImageDownloadService({ 
      minSizeKB: this.config.SMALL_IMAGE_SIZE_KB,
      timeout: 60000, // 60 seconds
    }, this.diskStorage);

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

  private async scrape(url: string, output_dir: string, retries: number = 2): Promise<PageData> {
    let html = "";
    let nextUrls: string[] = [];
    const blockedTypes = new Set([
      /*"image",*/
      "media",
      "font",
      /*'stylesheet'*/
    ]);
    const OUTPUT_DIR = path.resolve(output_dir, "images");
    await fs.promises.mkdir(OUTPUT_DIR, {recursive: true});

    console.log('\x1b[32mCRAWLING: \x1b[0m', url);

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
            this.imageDownloader.handleResponse(response, {prefix: OUTPUT_DIR});
          }
        });

        page.on("requestfailed", (request: any) => {
          if (request.resourceType() === "document") {
            console.log('\x1b[33mFAILED: \x1b[0m', request.url(), request.failure()?.errorText);
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
            console.log('\x1b[33mTIMEOUT: \x1b[0m', 'NAVIGATION');
            await page.evaluate(() => window.stop());
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
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: this.config.DEFAULT_TIMEOUT });
        } catch (error) {
          if (error instanceof Error && (error instanceof TimeoutError || error.name === "TimeoutError")) {
            console.log('\x1b[33mTIMEOUT: \x1b[0m', 'waitForNetworkIdle');
          } else {
            throw error;
          }
        }

        html = await page.content();

        if (html) {
          // Extractors test code //

          // const metaExtractor = new MetadataExtractor();
          // console.log(metaExtractor.extract(html, url));
          
          // const contentExtractor = new ContentExtractor();
          // const content = contentExtractor.extract(html, url);
          const linkExtractor = new LinkExtractor();
          nextUrls = linkExtractor.getCrawlableLinks(html, url);
          // const structuredDataExtractor = new StructuredDataExtractor();
          // const structuredData = structuredDataExtractor.extract(html, url);
          // const openGraphExtractor = new OpenGraphExtractor();
          // const openGraphData = openGraphExtractor.extract(html, url);
          // const imageExtractor = new ImageExtractor();
          // const images = imageExtractor.extract(html, url);
          // const performanceExtractor = new PerformanceExtractor();
          // const performanceData = await performanceExtractor.extract(page, url);
          
          // await fs.promises.writeFile(path.resolve(output_dir, 'performance.json'), JSON.stringify(performanceData, null, 2));
          // await page.screenshot({path: path.resolve(output_dir, 'screenshot.png')});
          break;
        } else {
          throw new Error("No HTML");
        }
      } catch (error) {
        console.log('\x1b[33mFinal Catch block \x1b[0m');
        if (i < retries) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        console.log('\x1b[31mERROR: \x1b[0m',
          `ATTEMPT ${i + 1}/${retries + 1}: Failed for ${url}\n Error: ${error instanceof Error ? error.message : error}`,
        );
      } finally {
        if (page) {
          console.log('\x1b[32mINFO: \x1b[0m', 'Waiting for all tasks to complete');

          // const timeout = new Promise((resolve) =>
          //   setTimeout(() => {
          //     console.log("Timeout Rejecting rest pending tasks");
          //     resolve();
          //   }, this.config.ALL_TASKS_TIMEOUT),
          // );

          // await Promise.race([
          //   timeout,
          //   Promise.allSettled(Array.from(imageTasks)),
          // ]);

          const downloadedImages = await this.imageDownloader.finish();
          console.log('\x1b[32mINFO: \x1b[0m', `Downloaded ${downloadedImages.length} images`);

          console.log('\x1b[32mINFO: \x1b[0m', 'All tasks completed.');

          await page.close();
          page = null;
        }
      }
    }

    return {html, crawlable_urls: nextUrls, page_url: url, extracted_data: null};
  }

  private async crawlPage(baseURL: string): Promise<void> {
    let currentUrls: Set<string> = new Set();
    currentUrls.add(baseURL);

    while (currentUrls.size > 0) {
      let promises: Promise<PageData>[] = [];

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

      res.forEach(({ html, crawlable_urls, page_url }) => {
        const pageData = extractPageData(html, page_url);
        const urlObj = new URL(page_url);
        writeJSONReport_One(
          pageData,
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
  }

  async crawl(): Promise<Record<string, ExtractedPageData>> {
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
      await this.crawlPage(this.baseUrl);
    } catch (error) {
      console.log('\x1b[31mERROR: \x1b[0m', error);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }

    return this.pages;
  }
}
