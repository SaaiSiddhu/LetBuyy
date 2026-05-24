export interface StorageObjectDescriptor {
  provider: 'r2' | 's3' | 'supabase-storage' | 'firebase-storage' | 'local';
  bucket: string;
  key: string;
  contentType?: string;
  sizeBytes?: number;
  checksum?: string;
}

export interface StorageAdapterPort {
  putObject(descriptor: StorageObjectDescriptor, body: ArrayBuffer | Uint8Array | ReadableStream): Promise<StorageObjectDescriptor>;
  getSignedUrl(descriptor: StorageObjectDescriptor, expiresInSeconds: number): Promise<string>;
  deleteObject(descriptor: StorageObjectDescriptor): Promise<void>;
}
