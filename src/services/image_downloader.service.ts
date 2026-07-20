import path from "node:path";
import fs from "node:fs";
import { HTTPResponse } from "puppeteer";
import {type ImageDownloadOptions} from "../types.js";

export default class ImageDownloadService {
  private tasks = new Set<Promise<string | null>>();
  private downloaded = new Set<string>();

  private readonly minSizeBytes: number;
  private readonly timeout: number;

  constructor(options: ImageDownloadOptions) {
    this.minSizeBytes = (options?.minSizeKB ?? 2) * 1024;
    this.timeout = options?.timeout ?? 10000;
  }

  handleResponse(response: HTTPResponse, dir_path: string): void {
    if (!this.isImage(response) || this.downloaded.has(response.url())) {
      return;
    }

    const task = this.download(response, dir_path);
    this.tasks.add(task);

    task.finally(() => {
      this.tasks.delete(task);
    });
  }

  async finish(): Promise<string[]> {
    const downloads = Promise.allSettled(this.tasks);

    // To handle the new incoming tasks while waiting for the existing ones to finish,
    // we can use a loop to keep checking if there are any remaining tasks. 
    // However, this can lead to an infinite loop if new tasks keep coming in. 
    // Instead, we can use a timeout mechanism to ensure that we don't wait indefinitely.
    //
    // while (this.tasks.size > 0) {
    //     await Promise.allSettled([...this.tasks]);
    // }

    const timer = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Image download timeout"));
      }, this.timeout);
    });

    try {
      await Promise.race([downloads, timer]);
    } catch (error) {
      console.error(
        "Image download timeout reached. Some images may not have been downloaded.",
      );
    } finally {
      return Array.from(this.downloaded);
    }
  }

  private isImage(response: HTTPResponse): boolean {
    return response.request().resourceType() === "image";
  }

  private async download(response: HTTPResponse, dir_path: string): Promise<string | null> {
    try {
      const headers = response.headers();
      const contentType = headers["content-type"] ?? "";
      const contentLength = Number(headers["content-length"] ?? 0);

      if (contentLength <= 0 || contentLength < this.minSizeBytes) {
        return null;
      }

      const buffer = await response.buffer();

      if (buffer.length < this.minSizeBytes) {
        return null;
      }

      await this.saveToDisk(dir_path, response.url(), contentType, buffer);
      this.downloaded.add(response.url());

      return response.url();
    } catch (error) {
      console.error("Failed downloading image:", response.url());
      return null;
    }
  }

  private async saveToDisk(
    dir_path: string,
    url: string,
    contentType: string = "image/jpeg",
    buffer: Buffer,
  ): Promise<void> {
    const parsedUrl = new URL(url);
    let fileName = path.basename(parsedUrl.pathname);

    // Fallback name if the pathname doesn't have an explicit file extension
    if (!fileName || !fileName.includes(".")) {
      const ext = contentType.split("/")[1] || "jpg";
      fileName = `captured_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    } else {
      fileName = `${Math.trunc(Math.random() * 10000000)}_${fileName}`;
    }

    const filePath = path.join(dir_path, fileName);
    await fs.promises.writeFile(filePath, buffer);
    console.log(`Saved image: ${fileName}`);
  }
}