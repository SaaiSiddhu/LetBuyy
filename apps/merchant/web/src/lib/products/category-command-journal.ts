import { ProductCategoryCommandIntentSchema, type ProductCategoryCommandIntent } from '@letbuyy/shared-types'
import { createScopedCommandJournal, type SavedScopedCommand } from '../api/scoped-command-journal'
const journal = createScopedCommandJournal('letbuyy.category-command.v1', ProductCategoryCommandIntentSchema, 'category')
export type SavedCategoryCommand = SavedScopedCommand<ProductCategoryCommandIntent>
export const readCategoryCommand = journal.read
export const retainCategoryCommand = journal.retain
export const clearCategoryCommand = journal.clear
export const withCategoryExecution = journal.withExecution
