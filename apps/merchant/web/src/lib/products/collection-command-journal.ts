import { CollectionMetadataCommandIntentSchema, type CollectionMetadataCommandIntent } from '@letbuyy/shared-types'
import { createScopedCommandJournal, type SavedScopedCommand } from '../api/scoped-command-journal'
const journal = createScopedCommandJournal('letbuyy.collection-metadata.v1', CollectionMetadataCommandIntentSchema, 'collection')
export type SavedCollectionCommand = SavedScopedCommand<CollectionMetadataCommandIntent>
export const readCollectionCommand = journal.read
export const retainCollectionCommand = journal.retain
export const clearCollectionCommand = journal.clear
export const withCollectionExecution = journal.withExecution
