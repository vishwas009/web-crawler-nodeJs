import { expect, test, describe } from "vitest";
import { normalizeURL } from "../utils/crawl_utils.js";

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
