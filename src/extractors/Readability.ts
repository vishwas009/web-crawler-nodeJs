import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export interface ReadabilityResult {
  title: string | null | undefined;
  content: string | null | undefined;
  textContent: string | null | undefined;
  length: number | null | undefined;
  excerpt: string | null | undefined;
  byline: string | null | undefined;
  dir: string | null | undefined;
  siteName: string | null | undefined;
  lang: string | null | undefined;
  publishedTime: string | null | undefined;
}

export function extractReadableContent(html: string): ReadabilityResult | null {
  const dom = new JSDOM(html);

  return new Readability(dom.window.document).parse();
}
