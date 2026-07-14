import { JSDOM } from "jsdom";
import { type ExtractedPageData } from "../types.js";

export function normalizeURL(url: string): string {
  const urlObj = new URL(url);

  return `${urlObj.hostname}${urlObj.pathname.replace(/\/$/, "")}`;
}

export function resolveUrl(url: string | null, baseUrl: string): string | null {
  if (!url) return null;

  try {
    return new URL(url, baseUrl).href.replace(/\/$/, "");
  } catch (error) {
    return null;
  }
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function getHeadingFromHTML(html: string): string {
  const dom = new JSDOM(html);
  let heading = dom.window.document.querySelector("h1");

  if (heading) {
    return heading.textContent || "";
  } else {
    heading = dom.window.document.querySelector("h2");
  }

  return heading ? heading.textContent || "" : "";
}

export function getFirstParagraphFromHTML(html: string): string {
  const dom = new JSDOM(html);
  const main = dom.window.document.querySelector("main");
  let firstParagraph: HTMLParagraphElement | null = null;

  if (main) {
    firstParagraph = main.querySelector("p");
    if (firstParagraph) {
      return firstParagraph.textContent || "";
    }
  }

  firstParagraph = dom.window.document.querySelector("p");
  return firstParagraph ? firstParagraph.textContent || "" : "";
}

export function getURLsFromHTML(html: string, baseURL: string): string[] {
  try {
    const dom = new JSDOM(html);
    const anchorElements = dom.window.document.querySelectorAll("a");
    const urls: string[] = [];

    anchorElements.forEach((anchor) => {
      const href = anchor.getAttribute("href");

      if (href && !(/\s/.test(href))) {
        const finalUrl = resolveUrl(href, baseURL);
        if (finalUrl) {
          urls.push(finalUrl);
        }
      }
    });

    return urls;
  } catch (error) {
    console.error("Error parsing HTML for URLs:", error);
    return [];
  }
}

export function getImagesFromHTML(html: string, baseURL: string): string[] {
  try {
    const dom = new JSDOM(html);
    const imgElements = dom.window.document.querySelectorAll("img");
    const urls: string[] = [];

    imgElements.forEach((img) => {
      const src = img.getAttribute("src");

      if (src) {
        try {
          if (/\s/.test(src)) {
            return;
          }

          const urlObj = new URL(src, baseURL);
          if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
            const match = /[^.]+$/.exec(urlObj.pathname);
            if(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(match ? match[0].toLowerCase() : "")) {
              urls.push(urlObj.href.replace(/\/$/, ""));
            }
          }
        } catch (error) {
          // Ignore invalid URLs
        }
      }
    });

    return urls;
  } catch (error) {
    console.error("Error parsing HTML for image URLs:", error);
    return [];
  }
}

export function getMediaFromHTML(html: string, baseURL: string): string[] {
  try {
    const dom = new JSDOM(html);
    const mediaElements = dom.window.document.querySelectorAll("audio, video");
    const urls: string[] = [];

    mediaElements.forEach((media) => {
      const src = media.getAttribute("src");

      if (src && !(/\s/.test(src))) {
        const finalUrl = resolveUrl(src, baseURL);
        if (finalUrl) {
          // TODO: Implement media type checking
          urls.push(finalUrl);
        }
      }
    });

    return urls;
  } catch (error) {
    console.error("Error parsing HTML for media URLs:", error);
    return [];
  }
}

export function extractPageData(html: string, pageURL: string): ExtractedPageData {
  const heading = getHeadingFromHTML(html);
  const firstParagraph = getFirstParagraphFromHTML(html);
  const urls = getURLsFromHTML(html, pageURL);
  const images = getImagesFromHTML(html, pageURL);
  const medias = getMediaFromHTML(html, pageURL);

  return {
    url: pageURL,
    heading,
    first_paragraph: firstParagraph,
    outgoing_links: urls,
    image_urls: images,
    media_urls: medias,
  };
}

export async function getHTML(url: string): Promise<string> {
  try {
    const response = await fetch(url, { headers: { "User-Agent": "BootCrawler/1.0" } });

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("text/html")) {
        console.log(`Got non-HTML response: ${contentType}`);
        return "";
      }

      return await response.text();
    } else {
      console.error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      return "";
    }

  } catch (error) {
    console.error(`Error fetching HTML for ${url}:`, error);
    return "";
  }
}

export async function crawlPage(baseURL: string, currentURL: string = baseURL, pages: Record<string, number> = {}) {
  const urlObj = new URL(currentURL);
  if(urlObj.hostname !== new URL(baseURL).hostname) {
    return;
  }

  const normalizedURL = normalizeURL(currentURL);
  if(pages[normalizedURL]) {
    pages[normalizedURL]++;
    return;
  }

  pages[normalizedURL] = 1;
  console.log(`Crawling: ${currentURL}`);

  const html = await getHTML(currentURL);
  if(html) {
    const urls = getURLsFromHTML(html, currentURL);
    for(const url of urls) {
      await crawlPage(baseURL, url, pages);
    }
  }
}