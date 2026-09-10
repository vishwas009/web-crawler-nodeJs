import { type StorageContext, StorableResource, StoredResource } from "../../types.js";

export abstract class StorageService {
    abstract save(
        item: StorableResource,
        context: StorageContext
    ): Promise<StoredResource>;

    async saveMany(
        items: StorableResource[],
        context: StorageContext
    ): Promise<StoredResource[]> {

        return Promise.all(
            items.map(item =>
                this.save(item, context)
            )
        );

    }

    abstract get type(): string ;

    // protected normalizeExtension(...) {}

    // protected sanitizeFileName(...) {}
}