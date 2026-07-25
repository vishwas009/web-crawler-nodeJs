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

export interface Image {
  src: string;
  alt: string;
  title: string | null;
  loading: "lazy" | "eager" | null;
  decoding: "async" | "sync" | "auto" | null;
  srcset: string[];
  sizes: string | null;
}

export interface NavigationTiming {
  dnsLookup: number;
  tcpConnection: number;
  tlsHandshake: number;
  request: number;
  response: number;
  domInteractive: number;
  domContentLoaded: number;
  loadComplete: number;
  totalPageLoad: number;
}

export interface PaintTiming {
  firstPaint?: number;
  firstContentfulPaint?: number;
}

export interface BrowserMetrics {
  documents: number | undefined;
  frames: number | undefined;
  nodes: number | undefined;
  jsEventListeners: number | undefined;
  layoutCount: number | undefined;
  recalcStyleCount: number | undefined;
  layoutDuration: number | undefined;
  recalcStyleDuration: number | undefined;
  scriptDuration: number | undefined;
  taskDuration: number | undefined;
  jsHeapUsedSize: number | undefined;
  jsHeapTotalSize: number | undefined;
}

export interface PerformanceData {
  navigation: NavigationTiming;
  paint: PaintTiming;
  browser: BrowserMetrics;
}
