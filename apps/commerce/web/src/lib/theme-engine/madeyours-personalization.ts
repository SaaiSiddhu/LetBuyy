import { PersonalizationFactsSchema, PersonalizationReviewContextSchema, PersonalizationCartDraftSchema, updatePersonalizationDraft, reviewPersonalization, type PersonalizationDraft, type PersonalizationCartDraft, type PersonalizationReviewContext } from '@letbuyy/commerce-core';

export interface MadeYoursPersonalizationController {
  restoreDraft(draft: PersonalizationDraft): void;
  readDraft(): PersonalizationDraft;
  setBasePurchasable(value: boolean): void;
  readReviewedDraft(): PersonalizationDraft | null;
  readReviewedCartDraft(): PersonalizationCartDraft | null;
  setSelection(variantId: string | null, purchasable: boolean): void;
  refreshReviewContext(message?: string): void;
  invalidateReview(message?: string): void;
  destroy(): void;
}

/** Enhances the canonical element; the caller supplies review-context reads and owns cart/storage mutations. */
export function bindMadeYoursPersonalization(element: HTMLElement, options?: {
  loadReviewContext(variantId: string | null, signal: AbortSignal): Promise<unknown>;
}): MadeYoursPersonalizationController | null {
  if (element.dataset.lbPersonalizationRequired !== 'true') return null;
  const purchase = element.querySelector<HTMLButtonElement>('[data-lb-add-to-cart]');
  if (purchase) purchase.disabled = true;
  let raw: unknown;
  try { raw = JSON.parse(element.dataset.lbPersonalizationFacts || 'null'); } catch { return null; }
  const parsed = PersonalizationFactsSchema.safeParse(raw);
  if (!parsed.success) return null;
  let facts = parsed.data;
  const root = element.querySelector<HTMLElement>('[data-lb-personalization]');
  if (!root || !purchase) return null;
  const method = root.querySelector<HTMLSelectElement>('[data-lb-personalization-method]');
  const text = root.querySelector<HTMLInputElement>('[data-lb-personalization-text]');
  const style = root.querySelector<HTMLSelectElement>('[data-lb-personalization-style]');
  const placement = root.querySelector<HTMLSelectElement>('[data-lb-personalization-placement]');
  const reviewButton = root.querySelector<HTMLButtonElement>('[data-lb-personalization-review]');
  const fields = root.querySelector<HTMLFieldSetElement>('[data-lb-personalization-fields]');
  const summary = root.querySelector<HTMLElement>('[data-lb-personalization-summary]');
  const error = root.querySelector<HTMLElement>('[data-lb-personalization-error]');
  if (!method || !text || !style || !placement || !reviewButton || !fields || !summary || !error) return null;
  const removers: (() => void)[] = [];
  let basePurchasable = false;
  let reviewedFingerprint: string | null = null;
  let state: ReturnType<typeof updatePersonalizationDraft> | undefined;
  let destroyed = false;
  let reviewContext: PersonalizationReviewContext | null = null;
  let selectedVariantId: string | null = null;
  let selectionKey: string | undefined;
  let contextRequest: AbortController | null = null;
  let contextEpoch = 0;
  const read = (): PersonalizationDraft => ({ method_id: method.value, style_id: style.value, placement_id: placement.value, text: text.value });
  const put = (selector: string, value: string) => { const node = root.querySelector<HTMLElement>(selector); if (node) node.textContent = value; };
  const listen = (node: Element, event: string, callback: () => void) => { node.addEventListener(event, callback); removers.push(() => node.removeEventListener(event, callback)); };
  const setStage = (stage: 'specify' | 'review') => {
    root.querySelectorAll<HTMLElement>('[data-lb-personalization-stage]').forEach(node => node.dataset.lbPersonalizationStage === stage ? node.setAttribute('aria-current', 'step') : node.removeAttribute('aria-current'));
  };
  const refreshPurchase = () => {
    const current = reviewPersonalization(facts, read());
    purchase.disabled = destroyed || !basePurchasable || Boolean(options && !reviewContext) || !current.valid || current.fingerprintInput !== reviewedFingerprint;
  };
  const paintPreview = () => {
    const preview = root.querySelector<HTMLElement>('[data-lb-personalization-preview]');
    if (preview) preview.hidden = !state?.lastValidPreview;
    put('[data-lb-personalization-preview-text]', state?.lastValidPreview?.text || '');
    const accepted = state?.lastValidPreview;
    const output = root.querySelector<HTMLElement>('[data-lb-personalization-preview-text]');
    if (output) output.style.fontFamily = accepted?.style.id === 'serif' ? 'Georgia, serif' : 'inherit';
    put('[data-lb-personalization-preview-note]', accepted ? `${state && !state.review.valid ? 'Showing the last valid text. Your current draft has errors. ' : ''}${accepted.style.label} · ${accepted.placement.label}` : '');
  };
  const normalize = element.ownerDocument.createElement('button');
  normalize.type = 'button'; normalize.className = 'my-link'; normalize.hidden = true;
  normalize.textContent = 'Use suggested text'; normalize.dataset.lbPersonalizationNormalize = '';
  error.after(normalize);
  const paintErrors = (visible: boolean) => {
    const problems = state && !state.review.valid ? state.review.issues : [];
    error.textContent = visible ? problems.map(issue => issue.message).join(' ') : '';
    error.hidden = !visible || problems.length === 0;
    text.setAttribute('aria-invalid', visible && problems.some(issue => issue.field === 'text') ? 'true' : 'false');
    const suggestion = problems.find(issue => issue.code === 'NORMALIZE_TEXT')?.suggested_text;
    normalize.hidden = !visible || !suggestion;
    normalize.textContent = suggestion ? `Use suggested text: ${suggestion}` : 'Use suggested text';
  };
  const update = (showErrors = true) => {
    state = updatePersonalizationDraft(facts, read(), state);
    reviewedFingerprint = null;
    summary.hidden = true; fields.hidden = false; reviewButton.hidden = false;
    setStage('specify'); paintPreview(); paintErrors(showErrors); refreshPurchase();
  };
  const invalidateReview = (message?: string) => {
    if (destroyed) return;
    update(false);
    if (message) { error.textContent = message; error.hidden = false; }
  };
  const populateChoices = (retainUnavailable = true) => {
    const fill = (select: HTMLSelectElement, choices: { id: string; label: string }[]) => {
      const prior = select.value;
      select.replaceChildren(...choices.map(choice => { const option = element.ownerDocument.createElement('option'); option.value = choice.id; option.textContent = choice.label; return option; }));
      if (retainUnavailable && prior && !choices.some(choice => choice.id === prior)) {
        const missing = element.ownerDocument.createElement('option'); missing.value = prior;
        missing.textContent = `Unavailable: ${prior}`; missing.disabled = true; select.prepend(missing);
      }
      if (prior && (retainUnavailable || choices.some(choice => choice.id === prior))) select.value = prior;
    };
    fill(method, facts.methods);
    const chosen = facts.methods.find(item => item.id === method.value);
    fill(style, chosen?.styles || []); fill(placement, chosen?.placements || []);
    put('[data-lb-personalization-help]', chosen ? `${chosen.min_graphemes}–${chosen.max_graphemes} characters. ${chosen.character_set === 'latin-name' ? 'A–Z letters' : 'Letters'}, spaces, apostrophes and hyphens.` : 'Choose an available personalization method.');
  };
  // An explicit new method keeps its existing product-defined defaults. A
  // refreshed/restored revoked choice remains visible and invalid instead.
  listen(method, 'change', () => { populateChoices(false); update(); });
  for (const input of [text, style, placement]) listen(input, input === text ? 'input' : 'change', () => update());
  listen(normalize, 'click', () => {
    const suggestion = state && !state.review.valid ? state.review.issues.find(issue => issue.code === 'NORMALIZE_TEXT')?.suggested_text : undefined;
    if (suggestion) { text.value = suggestion; update(); text.focus(); }
  });
  listen(reviewButton, 'click', () => {
    if (destroyed || (options && !reviewContext)) return;
    state = updatePersonalizationDraft(facts, read(), state);
    paintPreview(); paintErrors(true);
    if (!state.review.valid) { text.focus(); refreshPurchase(); return; }
    const accepted = state.review.accepted;
    put('[data-lb-personalization-summary-text]', accepted.text);
    put('[data-lb-personalization-summary-method]', accepted.method.label);
    put('[data-lb-personalization-summary-style]', accepted.style.label);
    put('[data-lb-personalization-summary-placement]', accepted.placement.label);
    reviewedFingerprint = state.review.fingerprintInput;
    summary.hidden = false; fields.hidden = true; reviewButton.hidden = true; setStage('review');
    summary.tabIndex = -1; summary.focus(); refreshPurchase();
  });
  const edit = root.querySelector<HTMLButtonElement>('[data-lb-personalization-edit]');
  if (edit) listen(edit, 'click', () => { update(false); text.focus(); });
  const unavailable = root.querySelector<HTMLElement>('[data-lb-personalization-unavailable]');
  const retry = element.ownerDocument.createElement('button');
  retry.type = 'button'; retry.className = 'my-link'; retry.dataset.lbPersonalizationRetry = '';
  retry.textContent = 'Try personalization again'; retry.hidden = true;
  unavailable?.after(retry);
  const setSelection = (variantId: string | null, purchasable: boolean) => {
    if (destroyed) return;
    const productId = element.dataset.productId;
    const key = JSON.stringify([productId, variantId, purchasable]);
    if (key === selectionKey) { refreshPurchase(); return; }
    selectionKey = key; selectedVariantId = variantId; basePurchasable = purchasable;
    contextRequest?.abort(); const epoch = ++contextEpoch;
    reviewContext = null; invalidateReview();
    retry.hidden = true;
    if (!options) { reviewButton.disabled = false; return; }
    reviewButton.disabled = true;
    if (unavailable) { unavailable.hidden = false; unavailable.textContent = purchasable ? 'Checking personalization choices…' : 'Choose an available product option to personalize.'; }
    if (!purchasable || !productId) return;
    const request = new AbortController(); contextRequest = request;
    void options.loadReviewContext(variantId, request.signal).then(value => {
      if (destroyed || request.signal.aborted || epoch !== contextEpoch || element.dataset.productId !== productId) return;
      const context = PersonalizationReviewContextSchema.safeParse(value);
      if (!context.success || context.data.product_id !== productId || context.data.variant_id !== variantId) throw new Error('Review context unavailable');
      reviewContext = context.data; facts = context.data.facts;
      populateChoices(); update(false); reviewButton.disabled = false;
      if (unavailable) unavailable.hidden = true;
    }).catch(() => {
      if (destroyed || request.signal.aborted || epoch !== contextEpoch) return;
      reviewContext = null; reviewButton.disabled = true; refreshPurchase();
      retry.hidden = false;
      if (unavailable) { unavailable.hidden = false; unavailable.textContent = 'Personalization is currently unavailable. Please try again later.'; }
    });
  };
  listen(retry, 'click', () => { selectionKey = undefined; setSelection(selectedVariantId, basePurchasable); });
  const readReviewedDraft = (): PersonalizationDraft | null => {
    if (destroyed || !basePurchasable || (options && !reviewContext)) return null;
    if (reviewContext && (reviewContext.product_id !== element.dataset.productId || reviewContext.variant_id !== selectedVariantId)) return null;
    const draft = read(), current = reviewPersonalization(facts, draft);
    return current.valid && current.fingerprintInput === reviewedFingerprint ? { ...draft } : null;
  };
  if (unavailable) unavailable.hidden = !options;
  populateChoices(); reviewButton.disabled = Boolean(options); update(false);
  return {
    restoreDraft(draft) {
      const set = (select: HTMLSelectElement, value: string) => {
        if (![...select.options].some(option => option.value === value)) {
          const option = element.ownerDocument.createElement('option'); option.value = value;
          option.textContent = `Unavailable: ${value}`; option.disabled = true; select.append(option);
        }
        select.value = value;
      };
      set(method, draft.method_id); set(style, draft.style_id); set(placement, draft.placement_id); text.value = draft.text;
      populateChoices(); update(false);
    },
    readDraft: read,
    setBasePurchasable(value) {
      if (options) { setSelection(selectedVariantId, value); return; }
      if (basePurchasable && !value) invalidateReview();
      basePurchasable = value; refreshPurchase();
    },
    readReviewedDraft,
    readReviewedCartDraft() {
      const draft = readReviewedDraft();
      if (!draft || !reviewContext) return null;
      const result = PersonalizationCartDraftSchema.safeParse({ ...draft, facts_revision: reviewContext.facts_revision, review_fingerprint: reviewContext.review_fingerprint });
      return result.success ? result.data : null;
    },
    setSelection,
    refreshReviewContext(message) { selectionKey = undefined; setSelection(selectedVariantId, basePurchasable); if (message) { error.textContent = message; error.hidden = false; } },
    invalidateReview,
    destroy() { destroyed = true; ++contextEpoch; contextRequest?.abort(); reviewContext = null; reviewedFingerprint = null; removers.forEach(remove => remove()); normalize.remove(); retry.remove(); purchase.disabled = true; reviewButton.disabled = true; if (unavailable) unavailable.hidden = false; },
  };
}

/** Cart presentation adapter for the SAME specification/review controller.
 * All customer values are assigned as text/properties; no draft enters HTML. */
export function createMadeYoursCartEditControls(document: Document, productId: string, facts: unknown): HTMLElement {
  const host = document.createElement('section');
  host.dataset.productId = productId; host.dataset.lbPersonalizationRequired = 'true';
  host.dataset.lbPersonalizationFacts = JSON.stringify(PersonalizationFactsSchema.parse(facts));
  host.setAttribute('aria-label', 'Edit personalization'); host.className = 'my-personalization';
  const root = document.createElement('div'); root.dataset.lbPersonalization = ''; host.append(root);
  const make = (tag: string, key: string, value?: string) => {
    const node = document.createElement(tag); node.setAttribute(`data-lb-personalization-${key}`, '');
    if (value) node.textContent = value; return node;
  };
  const stages = document.createElement('ol');
  for (const stage of ['Specify', 'Review']) { const li = document.createElement('li'); li.dataset.lbPersonalizationStage = stage.toLowerCase(); li.textContent = stage; stages.append(li); }
  const fields = make('fieldset', 'fields'); const legend = document.createElement('legend'); legend.textContent = 'Personalization details'; fields.append(legend);
  for (const [key, label, tag] of [['method', 'Method', 'select'], ['text', 'Name or text', 'input'], ['style', 'Style', 'select'], ['placement', 'Placement', 'select']]) {
    const wrapper = document.createElement('label'); wrapper.append(document.createTextNode(label));
    const input = make(tag, key); if (tag === 'input') { input.setAttribute('type', 'text'); input.setAttribute('autocomplete', 'off'); }
    wrapper.append(input); fields.append(wrapper);
  }
  fields.append(make('p', 'help'), make('p', 'error'));
  const preview = make('div', 'preview'); preview.append(make('output', 'preview-text'), make('p', 'preview-note'));
  const review = make('button', 'review', 'Review'); review.setAttribute('type', 'button');
  const summary = make('section', 'summary'); summary.setAttribute('aria-label', 'Reviewed personalization');
  for (const key of ['text', 'method', 'style', 'placement']) summary.append(make('p', `summary-${key}`));
  const edit = make('button', 'edit', 'Edit details'); edit.setAttribute('type', 'button'); summary.append(edit);
  root.append(stages, fields, preview, make('p', 'unavailable'), review, summary);
  const save = document.createElement('button'); save.type = 'button'; save.dataset.lbAddToCart = ''; save.textContent = 'Save reviewed changes'; save.disabled = true; host.append(save);
  return host;
}
