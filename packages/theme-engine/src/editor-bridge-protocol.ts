// Editor-bridge postMessage protocol constants.
// Both apps (merchant-web CenterPanel, customer-web preview bridge) must import from here.
// Do not inline these strings in either app — the contract test asserts both sides use this module.

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
