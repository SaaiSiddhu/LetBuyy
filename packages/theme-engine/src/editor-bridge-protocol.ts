// Editor-bridge postMessage protocol constants.
// Both apps (merchant-control-plane CenterPanel, storefront-runtime preview bridge) must import from here.
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
