import path from "node:path";
import { HTTPResponse } from "puppeteer";
import {type ImageDownloadOptions, StorageContext} from "../types.js";
import { type StorageService } from "./storage/StorageService.js";

export default class ImageDownloadService {
  private tasks = new Set<Promise<string | null>>();
  private downloaded = new Set<string>();

  private readonly minSizeBytes: number;
  private readonly timeout: number;
  private storage: StorageService;

  constructor(options: ImageDownloadOptions, storage: StorageService) {
    this.minSizeBytes = (options?.minSizeKB ?? 2) * 1024;
    this.timeout = options?.timeout ?? 10000;
    this.storage = storage;
  }

  handleResponse(response: HTTPResponse, context: StorageContext): void {
    if (!this.isImage(response) || this.downloaded.has(response.url())) {
      return;
    }

    const task = this.download(response, context);
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

    const timer = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Image download timeout"));
      }, this.timeout);
    });

    try {
      await Promise.race([downloads, timer]);
    } catch (error) {
      console.log('\x1b[33mTIMEOUT: \x1b[0m', "Image download timeout reached. Some images may not have been downloaded.");
    } finally {
      return Array.from(this.downloaded);
    }
  }

  private isImage(response: HTTPResponse): boolean {
    return response.request().resourceType() === "image";
  }

  private async download(response: HTTPResponse, context: StorageContext): Promise<string | null> {
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

      const url = response.url();
      const parsedUrl = new URL(url);
      let fileName = path.basename(parsedUrl.pathname);

      const res = await this.storage.save(
        {
          data: buffer,
          fileExtension: contentType.split("/")[1] || "",
          suggestedName: fileName.split(".")[0],
        },
        context,
      );

      this.downloaded.add(response.url());

      return response.url();
    } catch (error) {
      console.log('\x1b[33mFAILED DOWNLOADING IMAGE: \x1b[0m', response.url());
      return null;
    }
  }
}