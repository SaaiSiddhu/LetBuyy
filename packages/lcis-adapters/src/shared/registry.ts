/**
 * AdapterRegistry — the single catalog of live adapters. Registration is name-keyed and
 * duplicate names THROW (the structural anti-duplicate-adapter guarantee). The registry
 * only holds LiveAdapter references and fans out their read-only contract methods; it
 * adds no intelligence and never mutates anything.
 */
import type { AdapterMetadata, AdapterSnapshot, AdapterVerification, HealthResult, LiveAdapter } from './contracts';

export class AdapterRegistry {
  private readonly adapters = new Map<string, LiveAdapter>();

  register(adapter: LiveAdapter): void {
    const name = adapter.metadata().name;
    if (this.adapters.has(name)) {
      throw new Error(`lcis-adapters: duplicate adapter registration: '${name}'`);
    }
    this.adapters.set(name, adapter);
  }

  registerAll(adapters: readonly LiveAdapter[]): void {
    for (const a of adapters) this.register(a);
  }

  get(name: string): LiveAdapter | null {
    return this.adapters.get(name) ?? null;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  names(): readonly string[] {
    return [...this.adapters.keys()].sort();
  }

  list(): readonly AdapterMetadata[] {
    return this.names().map((n) => this.adapters.get(n)!.metadata());
  }

  size(): number {
    return this.adapters.size;
  }

  /** Health of every registered adapter (never throws — a failing adapter reports ERROR itself). */
  async healthAll(): Promise<readonly HealthResult[]> {
    const out: HealthResult[] = [];
    for (const name of this.names()) {
      out.push(await this.adapters.get(name)!.health());
    }
    return out;
  }

  async collectAll(): Promise<readonly AdapterSnapshot[]> {
    const out: AdapterSnapshot[] = [];
    for (const name of this.names()) {
      out.push(await this.adapters.get(name)!.collect());
    }
    return out;
  }

  async verifyAll(): Promise<readonly AdapterVerification[]> {
    const out: AdapterVerification[] = [];
    for (const name of this.names()) {
      out.push(await this.adapters.get(name)!.verify());
    }
    return out;
  }
}
