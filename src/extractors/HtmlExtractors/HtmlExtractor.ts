import { HtmlExtractorInterface, HtmlExtractorResult } from "./types.js";
import MetadataExtractor from "./MetadataExtractor.js";
import ContentExtractor from "./ContentExtractor.js";
import StructuredDataExtractor from "./StructuredDataExtractor.js";
import OpenGraphExtractor from "./OpenGraphExtractor.js";
import LinkExtractor from "./LinkExtractor.js";
import MediaExtractor from "./MediaExtractor.js";

export default class HtmlExtractor implements HtmlExtractorInterface<HtmlExtractorResult> {
  private metadataExtractor: MetadataExtractor;
  private contentExtractor: ContentExtractor; 
  private linksExtractor: LinkExtractor; 
  private structuredDataExtractor: StructuredDataExtractor; 
  private openGraphExtractor: OpenGraphExtractor; 
  private mediaExtractor: MediaExtractor; 

  constructor() {
    this.metadataExtractor = new MetadataExtractor();
    this.contentExtractor = new ContentExtractor();
    this.linksExtractor = new LinkExtractor();
    this.structuredDataExtractor = new StructuredDataExtractor();
    this.openGraphExtractor = new OpenGraphExtractor();
    this.mediaExtractor = new MediaExtractor();
  }

  public extract(html: string, pageUrl: string): HtmlExtractorResult {
    return {
      page_url: pageUrl,
      metadata: this.metadataExtractor.extract(html, pageUrl),
      content: this.contentExtractor.extract(html, pageUrl),
      links: this.linksExtractor.extract(html, pageUrl),
      crawlable_links: this.linksExtractor.getCrawlableLinks(html, pageUrl),
      structured_data: this.structuredDataExtractor.extract(html, pageUrl),
      open_graph_data: this.openGraphExtractor.extract(html, pageUrl),
      media: this.mediaExtractor.extract(html, pageUrl),
    };
  }
}
