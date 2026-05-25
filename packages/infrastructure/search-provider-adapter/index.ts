export interface SearchProviderDocument {
  id: string;
  type: string;
  tenantKey?: string;
  body: Record<string, unknown>;
}

export interface SearchProviderAdapterPort {
  index(document: SearchProviderDocument): Promise<void>;
  remove(documentId: string, tenantKey?: string): Promise<void>;
  query(query: string, tenantKey?: string, filters?: Record<string, unknown>): Promise<SearchProviderDocument[]>;
}
