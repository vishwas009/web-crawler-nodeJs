
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

// export function getImagesFromHTML(html: string, baseURL: string): string[] {
//   try {
//     const dom = new JSDOM(html);
//     const imgElements = dom.window.document.querySelectorAll("img");
//     const urls: string[] = [];

//     imgElements.forEach((img) => {
//       const src = img.getAttribute("src");

//       if (src) {
//         try {
//           if (/\s/.test(src)) {
//             return;
//           }

//           const urlObj = new URL(src, baseURL);
//           if (urlObj.protocol === "http:" || urlObj.protocol === "https:") {
//             const match = /[^.]+$/.exec(urlObj.pathname);
//             if(["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(match ? match[0].toLowerCase() : "")) {
//               urls.push(urlObj.href.replace(/\/$/, ""));
//             }
//           }
//         } catch (error) {
//           // Ignore invalid URLs
//         }
//       }
//     });

//     return urls;
//   } catch (error) {
//     console.error("Error parsing HTML for image URLs:", error);
//     return [];
//   }
// }

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
