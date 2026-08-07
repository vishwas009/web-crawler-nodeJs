import * as cheerio from "cheerio";
import { type Element } from "domhandler";
import { type Media, Media_Source } from "./types.js";
import { type HtmlExtractorInterface } from "./types.js";
import { resolveUrl } from "../../utils/crawl_utils.js";

export default class MediaExtractor implements HtmlExtractorInterface<Media[]>  {
    extract(html: string, pageUrl: string): Media[] {
        const $ = cheerio.load(html);
        const mediaList: Media[] = [];
        
        this.extractImages($, pageUrl, mediaList);
        this.extractVideos($, pageUrl, mediaList);
        this.extractAudio($, pageUrl, mediaList);

        return mediaList;
    }

    private extractImages($: cheerio.CheerioAPI, pageUrl: string, mediaList: Media[]): void {
        const imagesSet = new Set<string>();

        $('img').each((_, element) => {
            const image = this.extractImageAttributes($, element, pageUrl);
            if (image && image.src && !imagesSet.has(image.src)) {
                imagesSet.add(image.src);
                mediaList.push(image);
            }
        });
    }

    private extractVideos($: cheerio.CheerioAPI, baseUrl: string, mediaList: Media[]): void {
        $("video").each((_, el) => {
            const video = $(el);
            const sources: Media_Source[] = [];

            if (video.attr("src")) {
                sources.push({
                    src: resolveUrl(video.attr("src") as string, baseUrl) || ''
                });
            }

            video.find("source").each((_, source) => {
                const s = $(source);

                if (!s.attr("src")) return;

                sources.push({
                    src: resolveUrl(s.attr("src") as string, baseUrl) || '',
                    type: s.attr("type"),
                    media: s.attr("media")
                });
            });

            mediaList.push({
                src: video.attr("src") ? resolveUrl(video.attr("src") as string, baseUrl) : null,
                mediaType: "video",
                poster: video.attr("poster") && (resolveUrl(video.attr("poster") as string, baseUrl) || ''),
                autoplay: video.prop("autoplay") === 'true',
                controls: video.prop("controls") === 'true',
                loop: video.prop("loop") === 'true',
                muted: video.prop("muted") === 'true',
                playsInline: video.prop("playsinline") === 'true',
                preload: video.attr("preload"),
                crossorigin: video.attr("crossorigin"),
                sources
            });
        });
    }

    private extractAudio($: cheerio.CheerioAPI, baseUrl: string, mediaList: Media[]) {
        $("audio").each((_, el) => {
            const audio = $(el);
            const sources: Media_Source[] = [];

            if (audio.attr("src")) {
                sources.push({
                    src: resolveUrl(audio.attr("src") as string, baseUrl) || ''
                });
            }

            audio.find("source").each((_, source) => {
                const s = $(source);

                if (!s.attr("src")) return;

                sources.push({
                    src: resolveUrl(s.attr("src") as string, baseUrl) || '',
                    type: s.attr("type"),
                    media: s.attr("media")
                });

            });

            mediaList.push({
                src: audio.attr("src") ? resolveUrl(audio.attr("src") as string, baseUrl) : null,
                mediaType: "audio",
                autoplay: audio.prop("autoplay") === 'true',
                controls: audio.prop("controls") === 'true',
                loop: audio.prop("loop") === 'true',
                muted: audio.prop("muted") === 'true',
                preload: audio.attr("preload"),
                crossorigin: audio.attr("crossorigin"),
                sources
            });
        });
    }

    private extractImageAttributes($: cheerio.CheerioAPI, element: Element, pageUrl: string): Media | null {
        const src = this.getSrc($, element, pageUrl);
        if(!src) {
            return null;
        }

        return {
            mediaType: "image",
            src,
            alt: $(element).attr('alt') || '',
            title: $(element).attr('title') || '',
            loading: $(element).attr('loading') || '',
            decoding: $(element).attr('decoding') || '',
            srcset: this.getSrcset($, element, pageUrl),
            sizes: $(element).attr('sizes') || null,
            width: Number($(element).attr("width")) || undefined,
            height: Number($(element).attr("height")) || undefined,
            crossorigin: $(element).attr("crossorigin"),
            sources: [],
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