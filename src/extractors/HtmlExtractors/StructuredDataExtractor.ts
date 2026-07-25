import * as cheerio from "cheerio";
import { type StructuredData} from "../types.js";
import { type HtmlExtractor } from "./HtmlExtractor.js";

export default class StructuredDataExtractor implements HtmlExtractor<StructuredData[]> {
    public extract(html: string, pageUrl: string): StructuredData[] {
        const $ = cheerio.load(html);

        return this.extractStructuredData($);
    }

    private extractStructuredData($: cheerio.CheerioAPI): StructuredData[] {
        const structuredData: StructuredData[] = [];

        $('script[type="application/ld+json"]').each((_, element) => {
            try {
                const jsonText = $(element).html();
                if (jsonText) {
                    const data = JSON.parse(jsonText);
                    if (data) {
                        if(data["@graph"]) {
                            const graphData = Array.isArray(data["@graph"]) ? data["@graph"] : [data["@graph"]];
                            graphData.forEach((item) => {
                                structuredData.push({
                                    context: item["@context"] || data["@context"] || null,
                                    type: Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]],
                                    raw: item,
                                });
                            });

                            if(data["@type"]) {
                                delete data["@graph"];
                                structuredData.push({
                                    context: data["@context"] || null,
                                    type: Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]],
                                    raw: data,
                                });
                            }
                        } else {
                            structuredData.push({
                                context: data["@context"] || null,
                                type: Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]],
                                raw: data,
                            });
                            
                        }
                    }
                }
            } catch (error) {
            }
        });

        return structuredData;
    }
}
