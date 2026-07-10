// H5 — Theme Packager
//
// Produces a deterministic manifest (slug, schema_version, per-file SHA-256 checksums,
// content hash) from a LiquidThemePackageBundle via exportThemeBundleToFiles().
//
// The manifest is fully deterministic: no wall-clock timestamps, no random values.
// Same bundle input → bit-identical ThemePackageManifest on every call.

import { createHash } from 'node:crypto';
import type { LiquidThemePackageBundle } from './theme-bundle';
import { exportThemeBundleToFiles } from './theme-artifact-exporter';

export interface ThemePackageManifestFile {
  path: string;
  checksum: string;
  sizeBytes: number;
}

export interface ThemePackageManifest {
  slug: string;
  schema_version: string;
  files: ThemePackageManifestFile[];
  checksums: Record<string, string>;
  contentHash: string;
}

export function packageThemeBundle(bundle: LiquidThemePackageBundle): ThemePackageManifest {
  // exportThemeBundleToFiles returns a sorted-by-path list, ensuring deterministic order.
  const artifacts = exportThemeBundleToFiles(bundle);

  const files: ThemePackageManifestFile[] = [];
  const checksums: Record<string, string> = {};

  for (const artifact of artifacts) {
    const checksum = createHash('sha256').update(artifact.contents, 'utf8').digest('hex');
    const sizeBytes = Buffer.byteLength(artifact.contents, 'utf8');
    files.push({ path: artifact.path, checksum, sizeBytes });
    checksums[artifact.path] = checksum;
  }

  // contentHash = SHA-256 over the sorted checksum values joined with newlines.
  // This produces a stable fingerprint of the entire theme content.
  const sortedChecksumValues = Object.keys(checksums)
    .sort()
    .map((k) => checksums[k])
    .join('\n');
  const contentHash = createHash('sha256').update(sortedChecksumValues, 'utf8').digest('hex');

  return {
    slug: bundle.package.slug,
    schema_version: bundle.schema_version,
    files,
    checksums,
    contentHash,
  };
}
