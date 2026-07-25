export interface HtmlExtractor<T> {
  extract(
    html: string,
    pageUrl: string
  ): T;
}
