/**
 * Capability — a canonical LCIS capability and its consolidation disposition.
 * Mirrors LCIS_CAPABILITY_MATRIX.json (the 32 consolidated capabilities).
 */

export type Maturity = 'real' | 'partial' | 'experimental';

export type Disposition = 'keep' | 'merge' | 'migrate' | 'archive' | 'remove';

export interface Capability {
  readonly id: string;
  readonly name: string;
  /** Target lcis-core module (graph | blast-radius | memory | decision | architecture | verification | ...). */
  readonly module: string;
  readonly sourceFiles: readonly string[];
  readonly dependencies: readonly string[];
  readonly consumers: readonly string[];
  readonly maturity: Maturity;
  readonly disposition: Disposition;
}
