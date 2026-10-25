import { EDITOR_SECTION_SELECT_MESSAGE, EDITOR_SELECTION_MESSAGE, EDITOR_LEGACY_SELECTION_MESSAGE, EDITOR_SCROLL_MESSAGE, EDITOR_INSPECTOR_MODE_MESSAGE, INSPECTOR_SECTION_HOVERED, INSPECTOR_HOVER_CLEARED, EditorPreviewContextSchema, editorPreviewContextMatches, readEditorPreviewSelection, type EditorPreviewContext, type EditorPreviewIdentityIndex, type EditorPreviewSelection } from '@letbuyy/theme-engine/editor-bridge-protocol';

/** Adapt the existing Liquid DOM to the current saved editor document. DOM
 * attributes identify an intent; only canonical document membership accepts it. */
export function bindLiquidPreviewInspector(doc: Document, editorOrigin: string, identities: EditorPreviewIdentityIndex, context: EditorPreviewContext) {
    const win = doc.defaultView;
    if (!win || !editorOrigin || !EditorPreviewContextSchema.safeParse(context).success) return () => {};
    const targets = new Map<HTMLElement, EditorPreviewSelection>();
    const originals = new Map<HTMLElement, Map<string, string | null>>();
    const styles = ['storefront-liquid-editor-section', 'storefront-liquid-editor-section--selected'];
    let enabled = true;
    function decorate(element: HTMLElement, selection: EditorPreviewSelection) {
        element.setAttribute('role', 'button'); element.tabIndex = 0;
        element.setAttribute('aria-label', `Select ${selection.blockId ? 'block in ' : ''}${identities[selection.sectionId]!.type} section`);
        element.setAttribute('aria-pressed', 'false');
        if (!selection.blockId) element.dataset.letbuyyEditorSectionId = selection.sectionId;
        element.classList.add(styles[0]!);
    }
    function register(element: HTMLElement, selection: EditorPreviewSelection) {
        targets.set(element, selection);
        originals.set(element, new Map(['role', 'tabindex', 'aria-label', 'aria-pressed', 'data-letbuyy-editor-section-id', 'class'].map(key => [key, element.getAttribute(key)])));
        decorate(element, selection);
    }
    for (const section of doc.querySelectorAll<HTMLElement>('[data-theme-renderer="liquid"][data-editor-mode="true"] [data-section-id]')) {
        const sectionId = section.dataset.sectionId || '';
        if (!Object.hasOwn(identities, sectionId)) continue;
        register(section, { sectionId, blockPath: [] });
        for (const block of section.querySelectorAll<HTMLElement>('[data-block-id]')) {
            if (block.closest('[data-section-id]') !== section) continue;
            const blockId = block.dataset.blockId || '';
            if (!Object.hasOwn(identities[sectionId]!.blocks, blockId)) continue;
            register(block, { sectionId, blockId, blockPath: identities[sectionId]!.blocks[blockId]! });
        }
    }
    function select(selection: EditorPreviewSelection | null) {
        for (const [element, own] of targets) {
            const selected = own.sectionId === selection?.sectionId && own.blockId === selection?.blockId;
            element.classList.toggle(styles[1]!, selected);
            element.setAttribute('aria-pressed', String(selected));
        }
    }
    function target(event: Event) {
        if (!enabled) return null;
        const node = event.target;
        const element = node instanceof win!.Element ? node.closest<HTMLElement>('[data-block-id], [data-section-id]') : null;
        return element && targets.has(element) ? element : null;
    }
    function choose(event: Event) {
        const element = target(event);
        if (!element) return;
        event.preventDefault(); event.stopPropagation();
        const selection = targets.get(element)!;
        select(selection);
        win!.parent.postMessage({ type: EDITOR_SECTION_SELECT_MESSAGE, ...selection, sectionType: identities[selection.sectionId]!.type, context }, editorOrigin);
    }
    function key(event: KeyboardEvent) { if (event.key === 'Enter' || event.key === ' ') choose(event); }
    let hovered: EditorPreviewSelection | null = null;
    function clearHover() {
        if (hovered) win!.parent.postMessage({ type: INSPECTOR_HOVER_CLEARED, ...hovered, context }, editorOrigin);
        hovered = null;
    }
    function hover(event: Event) {
        const element = target(event), selection = element ? targets.get(element)! : null;
        if (hovered?.sectionId === selection?.sectionId && hovered?.blockId === selection?.blockId) return;
        clearHover(); hovered = selection;
        if (selection) win!.parent.postMessage({ type: INSPECTOR_SECTION_HOVERED, ...selection, sectionType: identities[selection.sectionId]!.type, context }, editorOrigin);
    }
    function leave(event: PointerEvent) {
        const next = (event.relatedTarget as Element | null)?.closest?.<HTMLElement>('[data-block-id], [data-section-id]');
        if (!next || !targets.has(next)) clearHover();
    }
    function message(event: MessageEvent) {
        if (event.source !== win!.parent || event.origin !== editorOrigin) return;
        const data = event.data;
        if (!data || !editorPreviewContextMatches(data.context, context)) return;
        if (data.type === EDITOR_INSPECTOR_MODE_MESSAGE && typeof data.enabled === 'boolean') {
            enabled = data.enabled;
            if (!enabled) clearHover();
            for (const [element, selection] of targets) {
                if (enabled) decorate(element, selection);
                else for (const [name, value] of originals.get(element)!) { if (value === null) element.removeAttribute(name); else element.setAttribute(name, value); }
            }
            return;
        }
        if (!enabled || ![EDITOR_SELECTION_MESSAGE, EDITOR_LEGACY_SELECTION_MESSAGE, EDITOR_SCROLL_MESSAGE].includes(data.type)) return;
        if (data.sectionId === null) { select(null); return; }
        const selection = readEditorPreviewSelection(data, identities);
        if (selection) select(selection);
    }
    doc.addEventListener('click', choose, true); doc.addEventListener('keydown', key, true);
    doc.addEventListener('pointerover', hover, true); doc.addEventListener('pointerout', leave, true); win.addEventListener('message', message);
    return () => {
        doc.removeEventListener('click', choose, true); doc.removeEventListener('keydown', key, true);
        doc.removeEventListener('pointerover', hover, true); doc.removeEventListener('pointerout', leave, true); win.removeEventListener('message', message);
        for (const [element, attributes] of originals) {
            for (const [name, value] of attributes) { if (value === null) element.removeAttribute(name); else element.setAttribute(name, value); }
        }
    };
}
