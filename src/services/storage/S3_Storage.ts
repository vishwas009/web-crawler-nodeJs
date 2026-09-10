import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {StorageService} from "./StorageService.js";
import { type StorageContext, StorableResource, StoredResource } from "../../types.js";
import fs from "node:fs";
import path from "node:path";
import crypto from 'crypto'

export default class S3_Storage extends StorageService {
    private s3Client: S3Client;

    constructor(s3_client: S3Client) {
        super();
        this.s3Client = s3_client;
    }

    get type(): string {
      return "ONLINE_STORAGE";
    }

  async save(item: StorableResource, context: StorageContext): Promise<StoredResource> {
    try {
      let fileName = '';
      if(item.suggestedName) {
        fileName = crypto.randomUUID() + '_' + item.suggestedName + (item.fileExtension ? `.${item.fileExtension}` : '');
      } else {
        fileName = crypto.randomUUID() + '_' + (item.fileExtension ? `.${item.fileExtension}` : '');
      }

      const filePath = path.posix.join(context.prefix, fileName);

      // 3. Set up the upload parameters
      const uploadParams = {
        Bucket: context.bucket_name,      
        Key: filePath,
        Body: item.data,
      };

      // 4. Execute the command to save the file
      const command = new PutObjectCommand(uploadParams);
      const data = await this.s3Client.send(command);

      return { path: filePath, size: item.data.length };
    } catch (error) {
      throw error; // Rethrow the error to be handled by the caller
    }
  }
}