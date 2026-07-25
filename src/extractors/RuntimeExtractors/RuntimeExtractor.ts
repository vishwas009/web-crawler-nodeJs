import type { Page } from "puppeteer";

export interface RuntimeExtractor<T> {
  extract(
    page: Page,
    pageUrl: string,
  ): Promise<T>;
}