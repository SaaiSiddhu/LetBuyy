/**
 * CredentialProvider — checks credential PRESENCE only. It never copies a secret
 * value into LCIS output, evidence, or logs. The value is exposed solely for placing
 * into an outbound provider request header (which goes to the source of truth, not LCIS).
 */
export interface CredentialPresence {
  readonly present: boolean;
  readonly required: readonly string[];
  readonly missing: readonly string[];
}

export class CredentialProvider {
  constructor(private readonly env: Record<string, string | undefined> = process.env) {}

  /** Presence + names of any missing vars. Values are never returned here. */
  check(required: readonly string[]): CredentialPresence {
    const missing = required.filter((k) => {
      const v = this.env[k];
      return v === undefined || v === '';
    });
    return { present: missing.length === 0, required, missing };
  }

  /**
   * The raw value, for placing into an outbound request header only.
   * NEVER log, cite, or include this in any AdapterSnapshot/Evidence.
   */
  value(key: string): string | undefined {
    return this.env[key];
  }
}
