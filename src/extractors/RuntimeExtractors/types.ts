import type { Page } from "puppeteer";

export interface RuntimeExtractorInterface<T> {
  extract(
    page: Page,
    pageUrl: string,
  ): Promise<T>;
}

export interface NavigationTiming {
  dnsLookup: number;
  tcpConnection: number;
  tlsHandshake: number;
  request: number;
  response: number;
  domInteractive: number;
  domContentLoaded: number;
  loadComplete: number;
  totalPageLoad: number;
}

export interface PaintTiming {
  firstPaint?: number;
  firstContentfulPaint?: number;
}

export interface BrowserMetrics {
  documents: number | undefined;
  frames: number | undefined;
  nodes: number | undefined;
  jsEventListeners: number | undefined;
  layoutCount: number | undefined;
  recalcStyleCount: number | undefined;
  layoutDuration: number | undefined;
  recalcStyleDuration: number | undefined;
  scriptDuration: number | undefined;
  taskDuration: number | undefined;
  jsHeapUsedSize: number | undefined;
  jsHeapTotalSize: number | undefined;
}

export interface PerformanceData {
  navigation: NavigationTiming;
  paint: PaintTiming;
  browser: BrowserMetrics;
}

export interface RuntimeExtractorResult {
  page_url: string;
  performance_data: PerformanceData;
  network_data?: any;
}
