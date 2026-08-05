import type { Page } from "puppeteer";
import { RuntimeExtractorInterface, RuntimeExtractorResult } from "./types.js";
import PerformanceExtractor from "./PerformanceExtractor.js";

export default class RuntimeExtractor implements RuntimeExtractorInterface<RuntimeExtractorResult> {
  private performanceExtractor: PerformanceExtractor;

  constructor() {
    this.performanceExtractor = new PerformanceExtractor();
  }

  public async extract(page: Page, pageUrl: string): Promise<RuntimeExtractorResult> {
    const performance_data = await this.performanceExtractor.extract(page, pageUrl);

    return {
      page_url: pageUrl,
      performance_data
    };
  }
}
