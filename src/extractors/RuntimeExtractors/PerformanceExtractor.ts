import type { Page } from "puppeteer";
import type { RuntimeExtractor } from "./RuntimeExtractor.js";
import type { PerformanceData, BrowserMetrics, NavigationTiming, PaintTiming } from "../types.js";

export default class PerformanceExtractor implements RuntimeExtractor<PerformanceData> {
  async extract(page: Page, pageUrl: string): Promise<PerformanceData> {
    const [navigation, paint, browser] = await Promise.all([
      this.extractNavigationTiming(page),
      this.extractPaintTiming(page),
      this.extractBrowserMetrics(page),
    ]);

    return {
      navigation,
      paint,
      browser,
    };
  }

  private async extractNavigationTiming(page: Page): Promise<NavigationTiming> {
    return page.evaluate(() => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;

      if (!nav) {
        return {
          dnsLookup: 0,
          tcpConnection: 0,
          tlsHandshake: 0,
          request: 0,
          response: 0,
          domInteractive: 0,
          domContentLoaded: 0,
          loadComplete: 0,
          totalPageLoad: 0,
        };
      }

      return {
        dnsLookup: nav.domainLookupEnd - nav.domainLookupStart,
        tcpConnection: nav.connectEnd - nav.connectStart,
        tlsHandshake:
          nav.secureConnectionStart > 0
            ? nav.connectEnd - nav.secureConnectionStart
            : 0,

        request: nav.responseStart - nav.requestStart,
        response: nav.responseEnd - nav.responseStart,
        domInteractive: nav.domInteractive,
        domContentLoaded: nav.domContentLoadedEventEnd,
        loadComplete: nav.loadEventEnd,
        totalPageLoad: nav.loadEventEnd - nav.startTime,
      };
    });
  }

  private async extractPaintTiming(page: Page): Promise<PaintTiming> {
    return page.evaluate(() => {
      const entries = performance.getEntriesByType("paint");

      const result: {
        firstPaint?: number;
        firstContentfulPaint?: number;
      } = {};

      for (const entry of entries) {
        switch (entry.name) {
          case "first-paint":
            result.firstPaint = entry.startTime;
            break;

          case "first-contentful-paint":
            result.firstContentfulPaint = entry.startTime;
            break;
        }
      }

      return result;
    });
  }

  private async extractBrowserMetrics(page: Page): Promise<BrowserMetrics> {
    const metrics = await page.metrics();

    return {
      documents: metrics.Documents,
      frames: metrics.Frames,
      nodes: metrics.Nodes,
      jsEventListeners: metrics.JSEventListeners,
      layoutCount: metrics.LayoutCount,
      recalcStyleCount: metrics.RecalcStyleCount,
      layoutDuration: metrics.LayoutDuration,
      recalcStyleDuration: metrics.RecalcStyleDuration,
      scriptDuration: metrics.ScriptDuration,
      taskDuration: metrics.TaskDuration,
      jsHeapUsedSize: metrics.JSHeapUsedSize,
      jsHeapTotalSize: metrics.JSHeapTotalSize,
    };
  }
}
