import * as cheerio from "cheerio";
import { type Content } from "./types.js";
import { type Extractor } from "./Extractor.js";
import { extractReadableContent } from "./readability.js";

export default class ContentExtractor implements Extractor<Content> {
  public extract(html: string, pageUrl: string): Content {
    const readability = extractReadableContent(html);
    const $ = cheerio.load(html);
    const $_readability = readability?.content ? cheerio.load(readability.content) : null;

    // const root = this.getContentRoot($);
    this.clean($.root());

    const paragraphs = this.extractParagraphs($_readability || $);
    // const article = paragraphs.join("\n\n");
    const article = readability?.textContent || paragraphs.join("\n\n");
    const wordCount = this.getWordCount(article);

    return {
      title: readability?.title || $("title").text().trim(),
      headings: this.extractHeadings($),
      article,
      paragraphs,
      lists: this.extractLists($),
      blockquotes: this.extractBlockquotes($_readability || $),
      codeBlocks: this.extractCodeBlocks($_readability || $),
      // tables: this.extractTables(root),
      wordCount,
      readingTime: Math.max(1, Math.ceil(wordCount / 200)),
      excerpt: readability?.excerpt || "",
      byline: readability?.byline || "",
      dir: readability?.dir || "",
      siteName: readability?.siteName || "",
      lang: readability?.lang || "",
      publishedTime: readability?.publishedTime || "",
    };
  }

  private getContentRoot($: cheerio.CheerioAPI) {
    if ($("article").length) {
      return $("article").first();
    } else if ($("main").length) {
      return $("main").first();
    } else {
      return $("body");
    }
  }

  private clean(root: cheerio.Cheerio<any>): void {
    root
      .find("script,style,noscript,svg,iframe,nav,footer,aside,form")
      .remove();
  }

  private extractHeadings($: cheerio.CheerioAPI) {
    return {
      h1: this.getTexts($, "h1"),
      h2: this.getTexts($, "h2"),
      h3: this.getTexts($, "h3"),
      h4: this.getTexts($, "h4"),
      h5: this.getTexts($, "h5"),
      h6: this.getTexts($, "h6"),
    };
  }

  private extractParagraphs(
    $: cheerio.CheerioAPI
  ): string[] {
    return this.getTexts($, "p");
  }

  private extractLists(
    $: cheerio.CheerioAPI
  ): string[][] {
    const lists: string[][] = [];

    $("ul,ol").each((_, list) => {
      const items: string[] = [];

      $(list)
        .find("li")
        .each((_, li) => {
          const text = this.normalizeText($(li).text());

          if (text) {
            items.push(text);
          }
        });

      if (items.length) {
        lists.push(items);
      }
    });

    return lists;
  }

  private extractBlockquotes(
    $: cheerio.CheerioAPI
  ): string[] {
    return this.getTexts($,"blockquote");
  }

  private extractCodeBlocks($: cheerio.CheerioAPI): string[] {
    const blocks: string[] = [];

    $("pre,code").each((_, code) => {
      const text = $(code).text().trim();

      if (text) {
        blocks.push(text);
      }
    });

    return blocks;
  }

  private normalizeText(text: string): string {
    return text.replace(/\s+/g, " ").trim();
  }

  private getTexts(
    $: cheerio.CheerioAPI,
    selector: string,
  ): string[] {
    const texts: string[] = [];

    $(selector).each((_, element) => {
      const text = this.normalizeText($(element).text());

      if (text) {
        texts.push(text);
      }
    });

    return texts;
  }

  private getWordCount(article: string): number {
    if (!article) {
      return 0;
    }

    return article.split(/\s+/).filter(Boolean).length;
  }
}
