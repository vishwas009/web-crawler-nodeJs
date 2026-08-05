import type { HtmlExtractorResult } from "./extractors/HtmlExtractors/types.js";
import type { RuntimeExtractorResult } from "./extractors/RuntimeExtractors/types.js";

export type ExtractedPageData = {
  pageHtmlData: HtmlExtractorResult | {};
  pageRuntimeData: RuntimeExtractorResult | {};
};

export interface ImageDownloadOptions {
  minSizeKB?: number;
  timeout?: number;
}

export interface StorageContext {
  prefix: string;
  bucket_name?: string;
}

export interface StorableResource {
  data: Buffer | string;
  fileExtension: string;
  suggestedName?: string;
}

export interface StoredResource {
  path: string;
  size: number;
}

export interface PageCrawlResult {
  extracted_data: ExtractedPageData;
  crawlable_urls: string[];
  page_url: string;
  success: boolean;
  crawl_time: number;
}

export interface CrawlSummary {
  pages_crawled: number;
  success: number;
  failed: number;
  average_page_time: number;
  total_duration: number;
}
