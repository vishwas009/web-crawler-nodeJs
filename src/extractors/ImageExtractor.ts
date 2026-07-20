import * as cheerio from "cheerio";
import { type Element } from "domhandler";
import { type Image } from "./types.js";
import { type Extractor } from "./Extractor.js";
import { resolveUrl } from "../utils/crawl.js";

export default class ImageExtractor implements Extractor<Image[]>  {
    extract(html: string, pageUrl: string): Image[] {
        const $ = cheerio.load(html);
        const images: Image[] = [];
        const imagesSet = new Set<string>();

        $('img').each((_, element) => {
            const image = this.extractImageAttributes($, element, pageUrl);
            if (image && !imagesSet.has(image.src)) {
                imagesSet.add(image.src);
                images.push(image);
            }
        });

        return images;
    }

    private extractImageAttributes($: cheerio.CheerioAPI, element: Element, pageUrl: string): Image | null {
        const src = this.getSrc($, element, pageUrl);
        if(!src) {
            return null;
        }

        return {
            src,
            alt: $(element).attr('alt') || '',
            title: $(element).attr('title') || '',
            loading: $(element).attr('loading') as "lazy" | "eager" | null || null,
            decoding: $(element).attr('decoding') as "async" | "sync" | "auto" | null || null,
            srcset: this.getSrcset($, element, pageUrl),
            sizes: $(element).attr('sizes') || null,
        }
    }

    private getSrc($: cheerio.CheerioAPI, element: Element, pageUrl: string): string | null {
        const src_attrib_names = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-srcset'];

        for (const attrib of src_attrib_names) {
            const value = $(element).attr(attrib);
            if (value) {
                return resolveUrl(value, pageUrl);
            }
        }

        return null;
    }

    private getSrcset($: cheerio.CheerioAPI, element: Element, pageUrl: string): string[] {
        const srcset = $(element).attr('srcset');
        if (!srcset) {
            return [];
        }

        return srcset.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0).map((s: string) => {
            const url = s.split(' ')[0];
            return resolveUrl(url, pageUrl) || '';
        }).filter((url: string) => url.length > 0);
    }
}