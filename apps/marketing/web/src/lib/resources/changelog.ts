import type { ChangelogEntry } from './types'

// Add only owner-verified published releases with traceable release evidence.
// Repository implementations and local test runs are not publication records.
export const CHANGELOG: ChangelogEntry[] = []
