import {StorageService} from "./StorageService.js";
import { type StorageContext, StorableResource, StoredResource } from "../../types.js";
import fs from "node:fs";
import path from "node:path";
import crypto from 'crypto'

export default class DiskStorage extends StorageService {
  async save(item: StorableResource, context: StorageContext): Promise<StoredResource> {
    try {
      let fileName = '';
      if(item.suggestedName) {
        fileName = item.suggestedName + "." + (item.fileExtension || '');

        if(fs.existsSync(path.join(context.prefix, fileName))) {
          fileName = crypto.randomUUID() + '_' + item.suggestedName + "." + (item.fileExtension || '');
        }
      } else {
        fileName = crypto.randomUUID() + '_' + "." + (item.fileExtension || '');
      }

      const filePath = path.join(context.prefix, fileName);
      
      await fs.promises.writeFile(filePath, item.data);

      return { path: filePath, size: item.data.length };
    } catch (error) {
      throw error; // Rethrow the error to be handled by the caller
    }
  }

  get type(): string {
    return "OFFLINE_STORAGE";
  }
}