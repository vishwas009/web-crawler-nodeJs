import {StorageService} from "./StorageService.js";
import { type StorageContext, StorableResource, StoredResource } from "../../types.js";
import fs from "node:fs";
import path from "node:path";
import crypto from 'crypto'

export default class DiskStorage extends StorageService {
  async save(item: StorableResource, context: StorageContext): Promise<StoredResource> {
    try {
      const ext = item.mimeType.split("/")[1] || "";
      const fileName = crypto.randomUUID() + '_' + (item.suggestedName || '') + "." + ext;
      const filePath = path.join(context.prefix, fileName);

      await fs.promises.writeFile(filePath, item.data);

      return { path: filePath, size: item.data.length };
    } catch (error) {
      console.log(error instanceof Error ? error.message : error);
      return { path: "", size: 0 };
    }
  }
}