import * as cheerio from "cheerio";
import { type Link } from "./types.js";
import { type HtmlExtractorInterface } from "./types.js";
import { normalizeText } from "../../utils/crawl_utils.js";

export default class LinkExtractor implements HtmlExtractorInterface<Link[]> {
  public extract(html: string, pageUrl: string): Link[] {
    const $ = cheerio.load(html);

    return this.extractLinksLean($, pageUrl);
  }

  public getCrawlableLinks(html: string, pageUrl: string): string[] {
    const $ = cheerio.load(html);
    const allLinks = this.extractLinks($, pageUrl);

    // Crawlable if internal, uses http/https and is not a download
    const crawlableLinks = allLinks.filter(
      (l) => l.isInternal && (l.protocol === "http:" || l.protocol === "https:") && !l.download
    );

    return crawlableLinks.map((l) => l.url);
  }

  private extractLinks($: cheerio.CheerioAPI, pageUrl: string): Link[] {
    const pageUrlObj = new URL(pageUrl);
    const links: Link[] = [];
    const linksSet = new Set<string>();

    $("a[href]").each((_, element) => {
      try {
        const href = $(element).attr("href");
        if (href && !/\s/.test(href)) {
          const urlObj = new URL(href, pageUrl);
          const absoluteUrl = urlObj.href.replace(/\/$/, "");

          if (linksSet.has(absoluteUrl)) {
            return;
          }
          linksSet.add(absoluteUrl);

          const relValues =
            $(element)
              .attr("rel")
              ?.split(/\s+/)
              .map((r) => r.toLowerCase())
              .filter(Boolean) ?? [];

          links.push({
            url: absoluteUrl,
            text: normalizeText($(element).text()),
            protocol: urlObj.protocol,
            isInternal: urlObj.hostname === pageUrlObj.hostname,
            isNoFollow: relValues.includes("nofollow"),
            download: $(element).is("[download]"),
            rel: relValues,
            title: $(element).attr("title") || null,
            target: $(element).attr("target") || null,
            type: $(element).attr("type") || null,
            hreflang: $(element).attr("hreflang") || null,
            referrerPolicy: $(element).attr("referrerpolicy") || null
          });
        }
      } catch (error) {}
    });

    return links;
  }

  private extractLinksLean($: cheerio.CheerioAPI, pageUrl: string): Link[] {
    const links: Link[] = [];
    const linksSet = new Set<string>();

    $("a[href]").each((_, element) => {
      try {
        const href = $(element).attr("href");
        if (href && !/\s/.test(href)) {
          const urlObj = new URL(href, pageUrl);
          const absoluteUrl = urlObj.href.replace(/\/$/, "");

          if (linksSet.has(absoluteUrl)) {
            return;
          }
          linksSet.add(absoluteUrl);

          links.push({
            url: absoluteUrl,
            text: normalizeText($(element).text()),
          });
        }
      } catch (error) {}
    });

    return links;
  }
}
