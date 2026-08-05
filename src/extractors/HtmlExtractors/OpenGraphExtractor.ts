import * as cheerio from "cheerio";
import { type OpenGraphData } from "./types.js";
import { type HtmlExtractorInterface } from "./types.js";
import { resolveUrl } from "../../utils/crawl_utils.js";

export default class OpenGraphExtractor implements HtmlExtractorInterface<OpenGraphData> {
    public extract(html: string, pageUrl: string): OpenGraphData {
        const $ = cheerio.load(html);
        return this.extractOpenGraphData($, pageUrl);
    }

    private extractOpenGraphData($: cheerio.CheerioAPI, pageUrl: string): OpenGraphData {
        const data: OpenGraphData = {
            images: [],
            videos: [],
            audios: [],
            extras: {}
        };

        $("meta[property^='og:']").each((_, el) => {
            const $el = $(el);
            const property = $el.attr("property");
            const content = $el.attr("content");

            if (!property || !content) return;

            switch (property) {
                case "og:title":
                    data.title = content;
                    break;
                case "og:description":
                    data.description = content;
                    break;
                case "og:type":
                    data.type = content;
                    break;
                case "og:url":
                    data.url = resolveUrl(content, pageUrl) || '';
                    break;
                case "og:site_name":
                    data.siteName = content;
                    break;
                case "og:locale":
                    data.locale = content;
                    break;
                case "og:image":
                    data.images.push(resolveUrl(content, pageUrl) || '');
                    break;
                case "og:video":
                    data.videos.push(resolveUrl(content, pageUrl) || '');
                    break;
                case "og:audio":
                    data.audios.push(resolveUrl(content, pageUrl) || '');
                    break;
                default:
                    data.extras[property] = content;
            }
        });

        return data;
    }
}