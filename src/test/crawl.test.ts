import { expect, test, describe } from "vitest";
import {
  normalizeURL,
  getHeadingFromHTML,
  getFirstParagraphFromHTML,
  getURLsFromHTML,
  getImagesFromHTML,
  extractPageData,
} from "../utils/crawl.js";

describe("normalizeURL Function", () => {
  test.for([
    {
      url: "https://www.boot.dev/blog/path/",
      expected: "www.boot.dev/blog/path",
    },
    {
      url: "https://www.boot.dev/blog/path",
      expected: "www.boot.dev/blog/path",
    },
    {
      url: "http://www.boot.dev/blog/path/",
      expected: "www.boot.dev/blog/path",
    },
    {
      url: "http://www.boot.dev/blog/path",
      expected: "www.boot.dev/blog/path",
    },
    { url: "https://crawler-test.com/path", expected: "crawler-test.com/path" },
    {
      url: "https://crawler-test.com/path/",
      expected: "crawler-test.com/path",
    },
    { url: "https://CRAWLER-TEST.com/path", expected: "crawler-test.com/path" },
    { url: "http://CRAWLER-TEST.com/path", expected: "crawler-test.com/path" },
  ])("$url => $expected", ({ url, expected }) => {
    expect(normalizeURL(url)).toBe(expected);
  });
});

describe("getHeadingFromHTML Function", () => {
  test.each([
    {
      html: `
    <html>
      <body>
          <h1>Welcome to Boot.dev</h1>
          <main>
          <p>Learn to code by building real projects.</p>
          <p>This is the second paragraph.</p>
          </main>
      </body>
    </html>`,
      expected: "Welcome to Boot.dev",
    },
    {
      html: `
    <html>
      <body>
          <h2>Secondary heading</h2>
          <p>Fallback heading case.</p>
      </body>
    </html>`,
      expected: "Secondary heading",
    },
    {
      html: `
    <html>
      <body>
          <div>No headings here</div>
      </body>
    </html>`,
      expected: "",
    },
  ])(
    "getHeadingFromHTML returns the first heading or empty string",
    ({ html, expected }) => {
      expect(getHeadingFromHTML(html)).toBe(expected);
    },
  );
});

describe("getFirstParagraphFromHTML Function", () => {
  test.each([
    {
      html: `
    <html><body>
      <p>Outside paragraph.</p>
      <main>
        <p>Main paragraph.</p>
      </main>
    </body></html>`,
      expected: "Main paragraph.",
    },
    {
      html: `
    <html><body>
      <p>First paragraph outside main.</p>
      <main>
        <p>Second paragraph in main.</p>
      </main>
    </body></html>`,
      expected: "Second paragraph in main.",
    },
    {
      html: `
    <html><body>
      <p>Only paragraph.</p>
    </body></html>`,
      expected: "Only paragraph.",
    },
    {
      html: `
    <html><body>
      <main>
        <div>No paragraph in main.</div>
      </main>
      <p>Fallback paragraph.</p>
    </body></html>`,
      expected: "Fallback paragraph.",
    },
    {
      html: `
    <html><body>
      <main></main>
    </body></html>`,
      expected: "",
    },
  ])(
    "getFirstParagraphFromHTML returns first paragraph from main or fallback",
    ({ html, expected }) => {
      expect(getFirstParagraphFromHTML(html)).toBe(expected);
    },
  );
});

describe("getURLsFromHTML Function", () => {
  test.each([
    {
      name: "getURLsFromHTML absolute",
      inputURL: "https://crawler-test.com",
      inputBody: `<html><body><a href="/path/one"><span>Boot.dev</span></a></body></html>`,
      expected: ["https://crawler-test.com/path/one"],
    },
    {
      name: "getURLsFromHTML relative URLs",
      inputURL: "https://example.com",
      inputBody: `<html><body><a href="post">Read more</a></body></html>`,
      expected: ["https://example.com/post"],
    },
    {
      name: "getURLsFromHTML multiple URLs",
      inputURL: "https://test.com",
      inputBody: `<html><body><a href="/page1">One</a><a href="/page2">Two</a><a href="/page3">Three</a></body></html>`,
      expected: [
        "https://test.com/page1",
        "https://test.com/page2",
        "https://test.com/page3",
      ],
    },
    {
      name: "getURLsFromHTML find all protocols URLs",
      inputURL: "https://example.com",
      inputBody: `<html><body><a href="/page">HTTP</a><a href="mailto:test@example.com">Email</a><a href="ftp://files.example.com">FTP</a></body></html>`,
      expected: ["https://example.com/page", "mailto:test@example.com", "ftp://files.example.com"],
    },
    {
      name: "getURLsFromHTML with no href attribute",
      inputURL: "https://example.com",
      inputBody: `<html><body><a>No href</a><a href="/valid">Valid</a></body></html>`,
      expected: ["https://example.com/valid"],
    },
    {
      name: "getURLsFromHTML absolute URLs",
      inputURL: "https://example.com",
      inputBody: `<html><body><a href="https://other.com/page">External</a><a href="http://another.com">Another</a></body></html>`,
      expected: ["https://other.com/page", "http://another.com"],
    },
    {
      name: "getURLsFromHTML empty HTML",
      inputURL: "https://example.com",
      inputBody: `<html><body></body></html>`,
      expected: [],
    },
    {
      name: "getURLsFromHTML invalid URLs are ignored",
      inputURL: "https://example.com",
      inputBody: `<html><body><a href="not a valid url">Invalid</a><a href="/valid">Valid</a></body></html>`,
      expected: ["https://example.com/valid"],
    },
  ])("$name", ({ inputURL, inputBody, expected }) => {
    const actual = getURLsFromHTML(inputBody, inputURL);
    expect(actual).toEqual(expected);
  });

  test("getURLsFromHTML absolute", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `<html><body><a href="https://crawler-test.com"><span>Boot.dev</span></a></body></html>`;
    const actual = getURLsFromHTML(inputBody, inputURL);
    const expected = ["https://crawler-test.com"];
    expect(actual).toEqual(expected);
  });

  test("getURLsFromHTML relative", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `<html><body><a href="/path/one"><span>Boot.dev</span></a></body></html>`;
    const actual = getURLsFromHTML(inputBody, inputURL);
    const expected = ["https://crawler-test.com/path/one"];
    expect(actual).toEqual(expected);
  });

  test("getURLsFromHTML both absolute and relative", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody =
      `<html><body>` +
      `<a href="/path/one"><span>Boot.dev</span></a>` +
      `<a href="https://other.com/path/one"><span>Boot.dev</span></a>` +
      `</body></html>`;
    const actual = getURLsFromHTML(inputBody, inputURL);
    const expected = [
      "https://crawler-test.com/path/one",
      "https://other.com/path/one",
    ];
    expect(actual).toEqual(expected);
  });
});

describe("getImagesFromHTML Function", () => {
  test.each([
    {
      name: "getImagesFromHTML single image",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="/image.png" alt="Test"></body></html>`,
      expected: ["https://example.com/image.png"],
    },
    {
      name: "getImagesFromHTML multiple images",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="/img1.png"><img src="/img2.jpg"><img src="/img3.gif"></body></html>`,
      expected: [
        "https://example.com/img1.png",
        "https://example.com/img2.jpg",
        "https://example.com/img3.gif",
      ],
    },
    {
      name: "getImagesFromHTML absolute image URLs",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="https://cdn.example.com/image.png"><img src="http://other.com/pic.jpg"></body></html>`,
      expected: [
        "https://cdn.example.com/image.png",
        "http://other.com/pic.jpg",
      ],
    },
    {
      name: "getImagesFromHTML relative image URLs",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="images/photo.png"></body></html>`,
      expected: ["https://example.com/images/photo.png"],
    },
    {
      name: "getImagesFromHTML no src attribute",
      inputURL: "https://example.com",
      inputBody: `<html><body><img alt="No src"><img src="/valid.png"></body></html>`,
      expected: ["https://example.com/valid.png"],
    },
    {
      name: "getImagesFromHTML empty HTML",
      inputURL: "https://example.com",
      inputBody: `<html><body></body></html>`,
      expected: [],
    },
    {
      name: "getImagesFromHTML filters non-http protocols",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="/valid.png"><img src="data:image/png;base64,ABC"><img src="file:///local.png"></body></html>`,
      expected: ["https://example.com/valid.png"],
    },
    {
      name: "getImagesFromHTML invalid URLs are ignored",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="not a valid url"><img src="/valid.png"></body></html>`,
      expected: ["https://example.com/valid.png"],
    },
    {
      name: "getImagesFromHTML ignores non-image URLs",
      inputURL: "https://example.com",
      inputBody: `<html><body><img src="/valid.png"><img src="/document.pdf"><img src="/image"></body></html>`,
      expected: ["https://example.com/valid.png"],
    },
  ])("$name", ({ inputURL, inputBody, expected }) => {
    const actual = getImagesFromHTML(inputBody, inputURL);
    expect(actual).toEqual(expected);
  });

  test("getImagesFromHTML absolute", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `<html><body><img src="https://crawler-test.com/logo.png" alt="Logo"></body></html>`;
    const actual = getImagesFromHTML(inputBody, inputURL);
    const expected = ["https://crawler-test.com/logo.png"];
    expect(actual).toEqual(expected);
  });

  test("getImagesFromHTML relative", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `<html><body><img src="/logo.png" alt="Logo"></body></html>`;
    const actual = getImagesFromHTML(inputBody, inputURL);
    const expected = ["https://crawler-test.com/logo.png"];
    expect(actual).toEqual(expected);
  });

  test("getImagesFromHTML multiple", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody =
      `<html><body>` +
      `<img src="/logo.png" alt="Logo">` +
      `<img src="https://cdn.boot.dev/banner.jpg">` +
      `</body></html>`;
    const actual = getImagesFromHTML(inputBody, inputURL);
    const expected = [
      "https://crawler-test.com/logo.png",
      "https://cdn.boot.dev/banner.jpg",
    ];
    expect(actual).toEqual(expected);
  });
});

describe("extractPageData Function", () => {
  test("extractPageData basic", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `
    <html><body>
      <h1>Test Title</h1>
      <p>This is the first paragraph.</p>
      <a href="/link1">Link 1</a>
      <img src="/image1.jpg" alt="Image 1">
    </body></html>
  `;

    const actual = extractPageData(inputBody, inputURL);
    const expected = {
      url: "https://crawler-test.com",
      heading: "Test Title",
      first_paragraph: "This is the first paragraph.",
      outgoing_links: ["https://crawler-test.com/link1"],
      image_urls: ["https://crawler-test.com/image1.jpg"],
      media_urls: []
    };

    expect(actual).toEqual(expected);
  });

  test("extractPageData multiple links and images", () => {
    const inputURL = "https://example.com";
    const inputBody = `
    <html><body>
      <h1>Welcome Page</h1>
      <p>This is a welcome paragraph.</p>
      <a href="https://example.com/about">About</a>
      <a href="/contact">Contact</a>
      <img src="https://cdn.example.com/header.png" alt="Header">
      <img src="/logo.png" alt="Logo">
    </body></html>
  `;

    const actual = extractPageData(inputBody, inputURL);
    const expected = {
      url: "https://example.com",
      heading: "Welcome Page",
      first_paragraph: "This is a welcome paragraph.",
      outgoing_links: [
        "https://example.com/about",
        "https://example.com/contact",
      ],
      image_urls: [
        "https://cdn.example.com/header.png",
        "https://example.com/logo.png",
      ],
      media_urls: []
    };

    expect(actual).toEqual(expected);
  });

  test("extractPageData with h2 instead of h1", () => {
    const inputURL = "https://test.com";
    const inputBody = `
    <html><body>
      <h2>Secondary Heading</h2>
      <p>First paragraph content.</p>
      <a href="/page1">Page 1</a>
    </body></html>
  `;

    const actual = extractPageData(inputBody, inputURL);
    const expected = {
      url: "https://test.com",
      heading: "Secondary Heading",
      first_paragraph: "First paragraph content.",
      outgoing_links: ["https://test.com/page1"],
      image_urls: [],
      media_urls: []
    };

    expect(actual).toEqual(expected);
  });

  test("extractPageData with missing elements", () => {
    const inputURL = "https://minimal.com";
    const inputBody = `
    <html><body>
      <div>Some content without heading or paragraphs</div>
    </body></html>
  `;

    const actual = extractPageData(inputBody, inputURL);
    const expected = {
      url: "https://minimal.com",
      heading: "",
      first_paragraph: "",
      outgoing_links: [],
      image_urls: [],
      media_urls: []
    };

    expect(actual).toEqual(expected);
  });

  test("extractPageData from main element", () => {
    const inputURL = "https://blog.com";
    const inputBody = `
    <html><body>
      <header><h1>Blog Title</h1></header>
      <main>
        <p>Main content paragraph.</p>
      </main>
      <aside>
        <p>Sidebar content.</p>
      </aside>
    </body></html>
  `;

    const actual = extractPageData(inputBody, inputURL);
    const expected = {
      url: "https://blog.com",
      heading: "Blog Title",
      first_paragraph: "Main content paragraph.",
      outgoing_links: [],
      image_urls: [],
      media_urls: []
    };

    expect(actual).toEqual(expected);
  });

  test("extract_page_data main section priority", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `
    <html><body>
      <nav><p>Navigation paragraph</p></nav>
      <main>
        <h1>Main Title</h1>
        <p>Main paragraph content.</p>
      </main>
    </body></html>
  `;

    const actual = extractPageData(inputBody, inputURL);
    expect(actual.heading).toEqual("Main Title");
    expect(actual.first_paragraph).toEqual("Main paragraph content.");
  });

  test("extract_page_data missing elements", () => {
    const inputURL = "https://crawler-test.com";
    const inputBody = `<html><body><div>No h1, p, links, or images</div></body></html>`;

    const actual = extractPageData(inputBody, inputURL);
    const expected = {
      url: "https://crawler-test.com",
      heading: "",
      first_paragraph: "",
      outgoing_links: [],
      image_urls: [],
      media_urls: []
    };

    expect(actual).toEqual(expected);
  });
});
