import {StorageService} from "./StorageService.js";
import { type StorageContext, StorableResource, StoredResource } from "../../types.js";
import fs from "node:fs";
import path from "node:path";

export default class DiskStorage extends StorageService {
  async save(item: StorableResource, context: StorageContext): Promise<StoredResource> {
    try {
      const ext = item.mimeType.split("/")[1] || "";
      const fileName = (item.suggestedName || `${Math.trunc(Math.random() * 10000000)}`) + "." + ext;
      const filePath = path.join(context.prefix, fileName);

      await fs.promises.writeFile(filePath, item.data);

      return { path: filePath, size: item.data.length };
    } catch (error) {
      console.log(error instanceof Error ? error.message : error);
      return { path: "", size: 0 };
    }
  }
}