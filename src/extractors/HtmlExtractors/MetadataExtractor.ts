import * as cheerio from "cheerio";
import { type Metadata } from "./types.js";
import { type HtmlExtractorInterface } from "./types.js";
import { resolveUrl } from "../../utils/crawl_utils.js";

export default class MetadataExtractor implements HtmlExtractorInterface<Metadata> {
  public extract(html: string, pageUrl: string): Metadata {
    const $ = cheerio.load(html);

    return {
      url: pageUrl,
      title: this.getTitle($),
      description: this.getMeta($, "description"),
      keywords: this.getKeywords($),
      canonicalUrl: resolveUrl(this.getCanonical($), pageUrl),
      robots: this.getMeta($, "robots"),
      language: this.getLanguage($),
      charset: this.getCharset($),
      favicon: resolveUrl(this.getFavicon($), pageUrl),
      viewport: this.getMeta($, "viewport"),
      author: this.getMeta($, "author"),
      generator: this.getMeta($, "generator"),
      themeColor: this.getMeta($, "theme-color"),
    };
  }

  private getMeta($: cheerio.CheerioAPI, name: string): string | null {
    const element = $("meta").filter((_, el) => {
      return $(el).attr("name")?.toLowerCase() === name.toLowerCase();
    });

    const value = element.attr("content");
    return value?.trim() || null;
  }

  private getTitle($: cheerio.CheerioAPI): string {
    return $("title").text().trim();
  }

  private getKeywords($: cheerio.CheerioAPI): string[] {
    const keywords = this.getMeta($, "keywords");
    
    if (!keywords) return [];

    return keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
  }

  private getFavicon($: cheerio.CheerioAPI): string | null {
    const icon = $("link")
      .filter((_, el) => {
        return $(el).attr("rel")?.toLowerCase().includes("icon");
    }).first();

    const href = icon.attr("href");
    return href?.trim() || null;
  }

  private getCharset($: cheerio.CheerioAPI): string | null {
    const charset = $("meta[charset]").attr("charset");

    return charset?.trim() || null;
  }

  private getLanguage($: cheerio.CheerioAPI): string | null {
    const lang = $("html").attr("lang");

    return lang?.trim() || null;
  }

  private getCanonical($: cheerio.CheerioAPI): string | null {
    const href = $('link[rel="canonical"]').attr("href");

    return href?.trim() || null;
  }
}
