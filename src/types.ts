export type ExtractedPageData = {
  url: string;
  heading: string;
  first_paragraph: string;
  outgoing_links: string[];
  image_urls: string[];
  media_urls: string[];
};

export interface ImageDownloadOptions {
  minSizeKB?: number;
  timeout?: number;
}

export interface StorageContext {
  prefix: string;
  bucket_name?: string;
}

export interface StorableResource {
  data: Buffer;
  mimeType: string;
  suggestedName?: string;
}

export interface StoredResource {
  path: string;
  size: number;
}
