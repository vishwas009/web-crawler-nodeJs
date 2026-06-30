export interface Extractor<T> {
  extract(
    html: string,
    pageUrl: string
  ): T;
}
