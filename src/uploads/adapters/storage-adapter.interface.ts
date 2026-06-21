export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER');

export interface StorageAdapter {
  save(buffer: Buffer, filename: string): Promise<string>;
  delete(url: string): Promise<void>;
}
