// Editor-bridge postMessage protocol constants.
// Both apps (merchant-web CenterPanel, customer-web preview bridge) must import from here.
// Do not inline these strings in either app — the contract test asserts both sides use this module.
import { z } from 'zod';
import { ThemeEditorTemplateKeySchema } from './template-registry';

/** Legacy name emitted by CenterPanel for backward compatibility with older preview iframes. */
export const EDITOR_LEGACY_SELECTION_MESSAGE = 'LETBUYY_THEME_EDITOR_SELECTION' as const;

/** Modern name used by the bridge and section frame. */
export const EDITOR_SELECTION_MESSAGE = 'letbuyy:theme-editor:section-selected' as const;

/** Sent by a section frame to the parent editor when the user selects a section. */
export const EDITOR_SECTION_SELECT_MESSAGE = 'letbuyy:theme-editor:section-select' as const;

/** Sent by the preview iframe to the parent editor on first load. */
export const EDITOR_READY_MESSAGE = 'letbuyy:storefront-preview:ready' as const;

/** Sent by the editor to request section scroll. */
export const EDITOR_SCROLL_MESSAGE = 'letbuyy:theme-editor:section-scroll' as const;

/** Sent by the editor to change the preview viewport. */
export const EDITOR_VIEWPORT_MESSAGE = 'letbuyy:theme-editor:viewport' as const;
/** Toggle interception without changing the saved document or buyer behavior. */
export const EDITOR_INSPECTOR_MODE_MESSAGE = 'letbuyy:theme-editor:inspect-mode' as const;

/** Legacy viewport name for backward compatibility. */
export const EDITOR_LEGACY_VIEWPORT_MESSAGE = 'LETBUYY_THEME_EDITOR_VIEWPORT' as const;

// ── Phase S — Live Preview Inspector ───────────────────────────────────────────
// These four constants extend the bridge for bidirectional hover/scroll/add-intent
// signalling between the preview section frames and the editor CenterPanel.

/**
 * Sent by a section frame to the parent editor when the pointer enters a section (preview → editor).
 * Payload: { sectionId: string; sectionType: string }
 */
export const INSPECTOR_SECTION_HOVERED = 'letbuyy:inspector:section-hovered' as const;

/**
 * Sent by a section frame to the parent editor when the pointer leaves a section (preview → editor).
 * Payload: { sectionId: string }
 */
export const INSPECTOR_HOVER_CLEARED = 'letbuyy:inspector:hover-cleared' as const;

/**
 * Sent by the preview when an add-section insert button is triggered (preview → editor, intent only).
 * The editor decides whether to open the add-section panel — the preview NEVER mutates sections.
 * Payload: { adjacentSectionId: string; position: 'before' | 'after' }
 */
export const INSPECTOR_ADD_SECTION_INTENT = 'letbuyy:inspector:add-section-intent' as const;

/**
 * Dispatched same-window inside the preview (NOT cross-origin) after scrollIntoView completes.
 * EditorPreviewSectionFrame listens for this to trigger a transient flash CSS class, distinct
 * from the persistent selected state triggered by EDITOR_SELECTION_MESSAGE.
 * The StorefrontPreviewBridge must NEVER match this type in its cross-origin message handler
 * (it is a same-window post and would form an infinite loop if re-processed there).
 * Payload: { sectionId: string }
 */
export const INSPECTOR_SECTION_SCROLLED_TO = 'letbuyy:inspector:section-scrolled-to' as const;

/** Correlation metadata, never an authorization credential or a preview token. */
export const EditorPreviewContextSchema = z.object({
    sessionId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    templateKey: ThemeEditorTemplateKeySchema,
    resourceId: z.string().min(1).max(200).regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/).optional(),
    page: z.number().int().min(1).max(1000).optional(),
}).strict();
export type EditorPreviewContext = z.infer<typeof EditorPreviewContextSchema>;

export interface EditorPreviewBlockIdentity { id: string; children?: readonly EditorPreviewBlockIdentity[] }
export interface EditorPreviewSectionIdentity { id: string; type: string; blocks?: readonly EditorPreviewBlockIdentity[] }
export type EditorPreviewIdentityIndex = Record<string, { type: string; blocks: Record<string, string[]> }>;
export type EditorPreviewSelection = { sectionId: string; blockId?: string; blockPath: string[] };

/** Derive identity from the current document, never from labels or DOM position. */
export function createEditorPreviewIdentityIndex(sections: readonly EditorPreviewSectionIdentity[]): EditorPreviewIdentityIndex {
    const index: EditorPreviewIdentityIndex = {};
    for (const section of sections) {
        const blocks: Record<string, string[]> = {};
        function visit(items: readonly EditorPreviewBlockIdentity[], ancestors: string[]) {
            for (const block of items) {
                if (Object.hasOwn(blocks, block.id)) throw new Error('Duplicate editor block identity');
                const path = [...ancestors, block.id];
                Object.defineProperty(blocks, block.id, { value: path, enumerable: true });
                visit(block.children || [], path);
            }
        }
        visit(section.blocks || [], []);
        if (Object.hasOwn(index, section.id)) throw new Error('Duplicate editor section identity');
        Object.defineProperty(index, section.id, { value: { type: section.type, blocks }, enumerable: true });
    }
    return index;
}

export function editorPreviewContextMatches(value: unknown, expected: EditorPreviewContext | null): boolean {
    if (!expected) return false;
    const parsed = EditorPreviewContextSchema.safeParse(value);
    return parsed.success && parsed.data.sessionId === expected.sessionId && parsed.data.revision === expected.revision
        && parsed.data.templateKey === expected.templateKey && parsed.data.resourceId === expected.resourceId && parsed.data.page === expected.page;
}

const selectionSchema = z.object({
    sectionId: z.string().min(1).max(120), blockId: z.string().min(1).max(120).optional(),
    blockPath: z.array(z.string().min(1).max(120)).max(16).default([]),
});

export function readEditorPreviewSelection(value: unknown, index: EditorPreviewIdentityIndex): EditorPreviewSelection | null {
    const parsed = selectionSchema.safeParse(value);
    if (!parsed.success || !Object.hasOwn(index, parsed.data.sectionId)) return null;
    const selection = parsed.data;
    if (!selection.blockId) return selection.blockPath.length === 0 ? selection : null;
    const blocks = index[selection.sectionId]!.blocks;
    if (!Object.hasOwn(blocks, selection.blockId)) return null;
    const expectedPath = blocks[selection.blockId]!;
    return expectedPath.length === selection.blockPath.length && expectedPath.every((id, i) => id === selection.blockPath[i]) ? selection : null;
}
