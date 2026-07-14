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
