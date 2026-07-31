/**
 * SignalRegistry — the honest NOT_CONNECTED → CONNECTED map. Every live signal LCIS can
 * consume is declared here: which adapter provides it, under which capability, and which
 * env vars must be present. `resolve()` reports the CURRENT connection state from
 * credential PRESENCE only — it never fabricates a value and never reads a secret into
 * output. Signals whose value is structurally unreachable (e.g. a POST-only provider API
 * behind the GET-only client) are declared `reachable: false` with the exact reason.
 */
import type { CredentialProvider } from './credentials';

export interface SignalDescriptor {
  /** Stable key, e.g. 'ci.workflow-runs' or 'money.settlements'. */
  readonly key: string;
  readonly description: string;
  /** The adapter (AdapterMetadata.name) that provides this signal. */
  readonly adapter: string;
  /** The adapter capability the signal maps to. */
  readonly capability: string;
  /** Env vars whose PRESENCE is required to connect this signal. */
  readonly requiredEnv: readonly string[];
  /**
   * False when the signal's value cannot be read through the GET-only boundary at all;
   * `unreachableReason` then names the exact structural cause.
   */
  readonly reachable: boolean;
  readonly unreachableReason?: string;
}

export interface SignalResolution {
  readonly signal: SignalDescriptor;
  readonly connection: 'CONNECTED' | 'NOT_CONNECTED';
  /** Env vars still missing (empty when CONNECTED). */
  readonly missingEnv: readonly string[];
  readonly detail: string;
}

export class SignalRegistry {
  private readonly signals = new Map<string, SignalDescriptor>();

  register(signal: SignalDescriptor): void {
    if (this.signals.has(signal.key)) {
      throw new Error(`lcis-adapters: duplicate signal registration: '${signal.key}'`);
    }
    this.signals.set(signal.key, signal);
  }

  registerAll(signals: readonly SignalDescriptor[]): void {
    for (const s of signals) this.register(s);
  }

  get(key: string): SignalDescriptor | null {
    return this.signals.get(key) ?? null;
  }

  keys(): readonly string[] {
    return [...this.signals.keys()].sort();
  }

  list(): readonly SignalDescriptor[] {
    return this.keys().map((k) => this.signals.get(k)!);
  }

  byAdapter(adapter: string): readonly SignalDescriptor[] {
    return this.list().filter((s) => s.adapter === adapter);
  }

  size(): number {
    return this.signals.size;
  }

  /** Current connection state for one signal, from credential presence only. */
  resolve(key: string, creds: CredentialProvider): SignalResolution | null {
    const signal = this.signals.get(key);
    if (!signal) return null;
    if (!signal.reachable) {
      return {
        signal,
        connection: 'NOT_CONNECTED',
        missingEnv: [],
        detail: `NOT CONNECTED — structurally unreachable: ${signal.unreachableReason ?? 'unreachable through the GET-only boundary'}.`,
      };
    }
    const presence = creds.check(signal.requiredEnv);
    if (!presence.present) {
      return {
        signal,
        connection: 'NOT_CONNECTED',
        missingEnv: presence.missing,
        detail: `NOT CONNECTED — set ${presence.missing.join(', ')} to enable '${signal.key}' via the '${signal.adapter}' adapter.`,
      };
    }
    return {
      signal,
      connection: 'CONNECTED',
      missingEnv: [],
      detail: `CONNECTED — '${signal.key}' is readable via the '${signal.adapter}' adapter (${signal.capability}).`,
    };
  }

  /** Resolve every signal — the platform-wide honest connectivity report. */
  resolveAll(creds: CredentialProvider): readonly SignalResolution[] {
    return this.keys().map((k) => this.resolve(k, creds)!);
  }
}
