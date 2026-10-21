import { EDITOR_SECTION_SELECT_MESSAGE, EDITOR_SELECTION_MESSAGE, EDITOR_LEGACY_SELECTION_MESSAGE, EDITOR_SCROLL_MESSAGE, INSPECTOR_SECTION_HOVERED, INSPECTOR_HOVER_CLEARED } from '@letbuyy/theme-engine/editor-bridge-protocol';

/** Adapt rendered Liquid sections to the existing editor protocol. Public pages
 * never opt in. The merchant editor remains the only document mutation owner. */
export function bindLiquidPreviewInspector(doc: Document, editorOrigin: string, sectionTypes: Record<string, string>) {
    const view = doc.defaultView;
    if (!view || !editorOrigin) return () => {};
    const win = view;
    const sections = new Map<HTMLElement, string>();
    const originals = new Map<HTMLElement, Map<string, string | null>>();
    for (const element of doc.querySelectorAll<HTMLElement>('[data-theme-renderer="liquid"][data-editor-mode="true"] [data-section-id]')) {
        const id = element.dataset.sectionId || '';
        if (!Object.hasOwn(sectionTypes, id)) continue;
        sections.set(element, id);
        originals.set(element, new Map(['role', 'tabindex', 'aria-label', 'aria-pressed', 'data-letbuyy-editor-section-id'].map(key => [key, element.getAttribute(key)])));
        element.setAttribute('role', 'button'); element.tabIndex = 0;
        element.setAttribute('aria-label', `Select ${sectionTypes[id]} section`);
        element.setAttribute('aria-pressed', 'false');
        element.dataset.letbuyyEditorSectionId = id;
        element.classList.add('storefront-liquid-editor-section');
    }
    function select(id: string) {
        for (const [element, ownId] of sections) {
            element.classList.toggle('storefront-liquid-editor-section--selected', ownId === id);
            element.setAttribute('aria-pressed', String(ownId === id));
        }
    }
    function target(event: Event) {
        const node = event.target;
        const element = node instanceof win.Element ? node.closest<HTMLElement>('[data-section-id]') : null;
        return element && sections.has(element) ? element : null;
    }
    function choose(event: Event) {
        const element = target(event);
        if (!element) return;
        event.preventDefault(); event.stopPropagation();
        const sectionId = sections.get(element)!;
        select(sectionId);
        win.parent.postMessage({ type: EDITOR_SECTION_SELECT_MESSAGE, sectionId, sectionType: sectionTypes[sectionId] }, editorOrigin);
    }
    function key(event: KeyboardEvent) { if (event.key === 'Enter' || event.key === ' ') choose(event); }
    let hovered: string | null = null;
    function clearHover() {
        if (hovered) win.parent.postMessage({ type: INSPECTOR_HOVER_CLEARED, sectionId: hovered }, editorOrigin);
        hovered = null;
    }
    function hover(event: Event) {
        const element = target(event), sectionId = element ? sections.get(element)! : null;
        if (hovered === sectionId) return;
        if (hovered) win.parent.postMessage({ type: INSPECTOR_HOVER_CLEARED, sectionId: hovered }, editorOrigin);
        hovered = sectionId;
        if (sectionId) win.parent.postMessage({ type: INSPECTOR_SECTION_HOVERED, sectionId, sectionType: sectionTypes[sectionId] }, editorOrigin);
    }
    function leave(event: PointerEvent) {
        const next = (event.relatedTarget as Element | null)?.closest?.<HTMLElement>('[data-section-id]');
        if (!next || !sections.has(next)) clearHover();
    }
    function message(event: MessageEvent) {
        if (event.source !== win.parent || event.origin !== editorOrigin) return;
        const data = event.data;
        if (!data || ![EDITOR_SELECTION_MESSAGE, EDITOR_LEGACY_SELECTION_MESSAGE, EDITOR_SCROLL_MESSAGE].includes(data.type)) return;
        const id = typeof data.sectionId === 'string' ? data.sectionId : data.selectedSectionId;
        if (typeof id === 'string' && Object.hasOwn(sectionTypes, id)) select(id);
    }
    doc.addEventListener('click', choose, true); doc.addEventListener('keydown', key, true);
    doc.addEventListener('pointerover', hover, true); doc.addEventListener('pointerout', leave, true); win.addEventListener('message', message);
    return () => {
        doc.removeEventListener('click', choose, true); doc.removeEventListener('keydown', key, true);
        doc.removeEventListener('pointerover', hover, true); doc.removeEventListener('pointerout', leave, true); win.removeEventListener('message', message);
        for (const [element, attributes] of originals) {
            element.classList.remove('storefront-liquid-editor-section', 'storefront-liquid-editor-section--selected');
            for (const [key, value] of attributes) { if (value === null) element.removeAttribute(key); else element.setAttribute(key, value); }
        }
    };
}
