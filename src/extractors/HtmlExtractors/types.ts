export interface HtmlExtractorInterface<T> {
  extract(
    html: string,
    pageUrl: string
  ): T;
}

export interface Metadata {
  url: string;
  title: string;
  description: string | null;
  keywords: string[];
  canonicalUrl: string | null;
  robots: string | null;
  language: string | null;
  charset: string | null;
  favicon: string | null;
  viewport: string | null;
  author: string | null;
  generator: string | null;
  themeColor: string | null;
}

export interface Content {
  title: string;
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
  };
  article: string;
  paragraphs: string[];
  lists: string[][];
  blockquotes: string[];
  codeBlocks: string[];
  // tables: string[][][];
  wordCount: number;
  readingTime: number;
  excerpt: string;
  byline: string;
  dir: string;
  siteName: string;
  lang: string;
  publishedTime: string;
}

export interface Link {
  url: string;
  text: string;
  title?: string | null;
  rel?: string[];
  target?: string | null;
  type?: string | null;
  hreflang?: string | null;
  referrerPolicy?: string | null;
  download?: boolean;
  isInternal?: boolean;
  isNoFollow?: boolean;
  protocol?: string | null;
}

export interface StructuredData {
  context: string | null;
  type: string[];
  raw: Record<string, unknown>;
}

export interface OpenGraphData {
  title?: string;
  description?: string;
  type?: string;
  url?: string;
  siteName?: string;
  locale?: string;
  images: string[];
  videos: string[];
  audios: string[];
  extras: Record<string, string>;
}

export type MediaType =
  | "image"
  | "video"
  | "audio";

export interface Media_Source {
  src: string;
  type?: string; 
  media?: string; 
}

export interface Media {
  mediaType: MediaType;
  src: string | null;
  sources: Media_Source[];
  alt?: string;
  title?: string;
  srcset?: string[];

  width?: number;
  height?: number;
  sizes?: string | null;

  loading?: string;
  decoding?: string;

  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: string;

  poster?: string;
  crossorigin?: string;
}

export interface HtmlExtractorResult {
  page_url: string;
  metadata: Metadata;
  content: Content;
  links: Link[];
  crawlable_links: string[];
  structured_data: StructuredData[];
  open_graph_data: OpenGraphData;
  media?: Media[];
}
