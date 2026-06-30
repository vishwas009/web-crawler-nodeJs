import * as cheerio from "cheerio";
import { type Content } from "./types.js";
import { type Extractor } from "./Extractor.js";

export default class ContentExtractor implements Extractor<Content> {
  public extract(html: string, pageUrl: string): Content {
    const $ = cheerio.load(html);

    const root = this.getContentRoot($);
    this.clean(root);

    const paragraphs = this.extractParagraphs($, root);
    const article = paragraphs.join("\n\n");
    const wordCount = this.getWordCount(article);

    return {
      title: $("title").text().trim(),
      headings: this.extractHeadings($, root),
      article,
      paragraphs,
      lists: this.extractLists($, root),
      blockquotes: this.extractBlockquotes($, root),
      codeBlocks: this.extractCodeBlocks($, root),
      // tables: this.extractTables(root),
      wordCount,
      readingTime: Math.max(1, Math.ceil(wordCount / 200)),
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

  private extractHeadings($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>) {
    return {
      h1: this.getTexts($, root, "h1"),
      h2: this.getTexts($, root, "h2"),
      h3: this.getTexts($, root, "h3"),
      h4: this.getTexts($, root, "h4"),
      h5: this.getTexts($, root, "h5"),
      h6: this.getTexts($, root, "h6"),
    };
  }

  private extractParagraphs(
    $: cheerio.CheerioAPI,
    root: cheerio.Cheerio<any>,
  ): string[] {
    return this.getTexts($, root, "p");
  }

  private extractLists(
    $: cheerio.CheerioAPI,
    root: cheerio.Cheerio<any>,
  ): string[][] {
    const lists: string[][] = [];

    root.find("ul,ol").each((_, list) => {
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
    $: cheerio.CheerioAPI,
    root: cheerio.Cheerio<any>,
  ): string[] {
    return this.getTexts($, root, "blockquote");
  }

  private extractCodeBlocks($: cheerio.CheerioAPI, root: cheerio.Cheerio<any>): string[] {
    const blocks: string[] = [];

    root.find("pre,code").each((_, code) => {
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
    root: cheerio.Cheerio<any>,
    selector: string,
  ): string[] {
    const texts: string[] = [];

    root.find(selector).each((_, element) => {
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
