import { foodPackSummary } from '@letbuyy/commerce-core';
import { parseVariantFactPresentation, type PickerVariant, type VariantFactDisplay } from './variant-options-carrier';
type SelectionState = 'incomplete' | 'unknown' | 'selected' | 'unavailable' | 'product';
const DISPLAY_LABELS = {
    furniture: { assembled: 'Assembled dimensions', package: 'Package dimensions', weight: 'Weight', seat_height: 'Seat height', materials: 'Materials', assembly: 'Assembly', care: 'Care' },
    sports: { length: 'Length', weight: 'Weight', grip: 'Grip circumference', dimensions: 'Dimensions' },
    toys: { age: 'Age information', contents: 'Included contents', dimensions: 'Dimensions', additional_dimensions: 'Other dimensions', materials: 'Materials', finish: 'Finish', care: 'Care', warnings: 'Supplied warnings' },
    books: { authors: 'Authors', language: 'Language', format: 'Format', edition: 'Edition', dimensions: 'Dimensions' },
} as const;
const DOMAIN_LABELS = { furniture: 'Furniture facts', sports: 'Equipment facts', toys: 'Toy facts', books: 'Edition facts' } as const;
/** Read-only DOM enhancement. Selection and mutation authority stay with the existing picker/cart. */
export class VariantFactsController {
    private readonly restores: Array<() => void> = [];
    private readonly created: HTMLElement[] = [];
    private readonly food: HTMLElement | null;
    private readonly furniture: HTMLElement | null;
    private foodDisplay: HTMLElement | null = null;
    private current: HTMLElement | null = null;
    private selected: PickerVariant | null = null;
    private state: SelectionState = 'incomplete';
    private disposed = false;
    private readonly commonFurniture = new Map<HTMLElement, string>();
    private readonly commonFurnitureStatus: string;
    private readonly productFacts: VariantFactDisplay | null;
    private readonly handleQuantity = (event: Event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.matches('[name="quantity"],[data-lb-quantity]') || target.closest('[data-section-id]') !== this.section) {
            return;
        }
        this.renderFood();
    };
    constructor(private readonly section: HTMLElement, private readonly productId: string, private readonly currency: string, variants: PickerVariant[], private readonly productOnly = false) {
        const owned = (selector: string) => [...section.querySelectorAll<HTMLElement>(selector)].find(element => element.closest('[data-section-id]') === section && (!element.dataset.productId || element.dataset.productId === productId)) || null;
        this.food = owned('[data-lb-food-presentation]');
        this.furniture = owned('[data-lb-variant-facts][data-lb-facts-namespace="furniture"]');
        this.productFacts = this.food ? parseVariantFactPresentation(this.food.dataset.facts) : null;
        this.commonFurnitureStatus = this.furniture?.querySelector('[data-lb-variant-facts-status]')?.textContent || 'Common product facts — select all options.';
        for (const slot of this.furniture?.querySelectorAll<HTMLElement>('[data-lb-furniture-field]') || []) {
            this.commonFurniture.set(slot, slot.textContent || '');
        }
        if (this.furniture) {
            const previous = this.furniture.getAttribute('data-lb-variant-facts-state');
            const previousId = this.furniture.getAttribute('data-variant-id');
            this.restores.push(() => {
                if (previousId === null) {
                    this.furniture!.removeAttribute('data-variant-id');
                }
                else {
                    this.furniture!.setAttribute('data-variant-id', previousId);
                }
                if (previous === null) {
                    this.furniture!.removeAttribute('data-lb-variant-facts-state');
                }
                else {
                    this.furniture!.setAttribute('data-lb-variant-facts-state', previous);
                }
                this.restoreFurniture();
            });
        }
        if (this.food) {
            for (const child of [...this.food.children]) {
                if (!(child instanceof HTMLElement)) {
                    continue;
                }
                const hidden = child.hidden;
                child.hidden = true;
                this.restores.push(() => child.hidden = hidden);
            }
            this.foodDisplay = this.node('div');
            this.foodDisplay.setAttribute('data-lb-current-food', '');
            this.foodDisplay.setAttribute('role', 'status');
            this.foodDisplay.setAttribute('aria-live', 'polite');
            this.foodDisplay.setAttribute('aria-atomic', 'true');
            this.food.append(this.foodDisplay);
            this.created.push(this.foodDisplay);
        }
        const hasOther = variants.some(variant => variant.factPresentation && Object.keys(variant.factPresentation).some(key => key !== 'food' && (key !== 'furniture' || !this.furniture)));
        if (hasOther && !productOnly) {
            this.current = owned('[data-lb-selected-variant-facts]');
            if (!this.current) {
                this.current = this.node('section');
                this.current.setAttribute('data-lb-selected-variant-facts', '');
                this.current.dataset.productId = productId;
                this.current.setAttribute('aria-label', 'Selected variant facts');
                section.querySelector('lb-variant-picker')?.after(this.current);
                this.created.push(this.current);
            }
            else {
                const children = [...this.current.childNodes];
                const initialId = this.current.getAttribute('data-variant-id');
                const initialState = this.current.getAttribute('data-selection-state');
                this.restores.push(() => {
                    this.current!.replaceChildren(...children);
                    for (const [name, value] of [['data-variant-id', initialId], ['data-selection-state', initialState]]) {
                        if (value === null) this.current!.removeAttribute(name!);
                        else this.current!.setAttribute(name!, value!);
                    }
                });
            }
        }
        section.addEventListener('input', this.handleQuantity);
        section.addEventListener('change', this.handleQuantity);
        this.state = productOnly ? 'product' : 'incomplete';
        this.render();
    }
    update(variant: PickerVariant | null, state: Exclude<SelectionState, 'product'>) {
        if (this.disposed) {
            return;
        }
        this.selected = variant;
        this.state = state;
        this.render();
    }
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        this.section.removeEventListener('input', this.handleQuantity);
        this.section.removeEventListener('change', this.handleQuantity);
        for (const restore of this.restores) {
            restore();
        }
        for (const element of this.created) {
            element.remove();
        }
        this.selected = null;
    }
    private node<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
        const element = this.section.ownerDocument.createElement(tag);
        if (text !== undefined) {
            element.textContent = text;
        }
        return element;
    }
    private selectionLabel() {
        return this.selected?.label || 'Selected variant';
    }
    private selectedFacts() {
        return ['selected', 'unavailable'].includes(this.state) ? this.selected?.factPresentation || null : this.state === 'product' ? this.productFacts : null;
    }
    private status() {
        if (this.state === 'incomplete') {
            return 'Choose all options to see facts for the selected variant.';
        }
        if (this.state === 'unknown') {
            return 'No variant matches these options. Selected variant facts are unavailable.';
        }
        if (this.state === 'unavailable') {
            return `${this.selectionLabel()} — unavailable. Purchase is unavailable for this option.`;
        }
        return `${this.selectionLabel()}.`;
    }
    private render() {
        this.renderFood();
        this.renderFurniture();
        this.renderOtherFacts();
    }
    private renderFood() {
        if (!this.foodDisplay || this.disposed) {
            return;
        }
        this.foodDisplay.replaceChildren();
        this.foodDisplay.dataset.variantId = this.selected?.id || '';
        this.foodDisplay.dataset.selectionState = this.state;
        const facts = this.selectedFacts()?.food;
        if (this.state !== 'product') {
            this.foodDisplay.append(this.node('p', this.status()));
        }
        if (facts) {
            const net = this.node('p', `${facts.netQuantityValue} ${facts.netQuantityUnit} net per pack`);
            net.setAttribute('data-lb-food-net-quantity', '');
            this.foodDisplay.append(net);
            if (facts.unitPriceMinor !== undefined) {
                const currency = /^[A-Z]{3}$/.test(this.currency) ? this.currency : 'INR';
                let price: string;
                try {
                    price = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(facts.unitPriceMinor / 100);
                }
                catch {
                    price = `${(facts.unitPriceMinor / 100).toFixed(2)} ${currency}`;
                }
                const unit = this.node('p', `${price} / ${facts.basisQuantity} ${facts.netQuantityUnit}`);
                unit.setAttribute('data-lb-food-unit-price', '');
                this.foodDisplay.append(unit);
            }
            if (this.state !== 'unavailable') {
                const input = [...this.section.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[name="quantity"],[data-lb-quantity]')].find(element => element.closest('[data-section-id]') === this.section);
                const count = input ? Number(input.value) : 1;
                const summary = foodPackSummary(count, { value: facts.netQuantityValue, unit: facts.netQuantityUnit });
                const quantity = this.node('p', summary ? `${summary.packCount} sellable ${summary.packCount === 1 ? 'pack' : 'packs'} · ${summary.totalNetQuantity.value} ${summary.totalNetQuantity.unit} total net contents.` : 'Enter a whole pack count from 1 to 999 to compare total net contents.');
                quantity.setAttribute('data-lb-food-pack-context', '');
                this.foodDisplay.append(quantity);
            }
        }
        else if (['selected', 'unavailable', 'product'].includes(this.state)) {
            this.foodDisplay.append(this.node('p', 'Net quantity not supplied for this variant.'));
        }
        this.foodDisplay.append(this.node('p', 'Quantity counts sellable packs. Shipping is calculated at checkout.'));
    }
    private restoreFurniture() {
        for (const [slot, text] of this.commonFurniture) {
            slot.textContent = text;
        }
        const status = this.furniture?.querySelector<HTMLElement>('[data-lb-variant-facts-status]');
        if (status) {
            status.textContent = this.commonFurnitureStatus;
        }
    }
    private renderFurniture() {
        if (!this.furniture) {
            return;
        }
        const matched = this.selected && ['selected', 'unavailable'].includes(this.state);
        const status = this.furniture.querySelector<HTMLElement>('[data-lb-variant-facts-status]');
        if (!matched) {
            this.restoreFurniture();
            this.furniture.dataset.lbVariantFactsState = 'common';
            this.furniture.removeAttribute('data-variant-id');
            if (status && this.state === 'unknown') {
                status.textContent = 'No variant matches these options. Common product facts are shown.';
            }
            return;
        }
        const facts = this.selectedFacts()?.furniture;
        for (const slot of this.commonFurniture.keys()) {
            const key = slot.dataset.lbFurnitureField as keyof NonNullable<VariantFactDisplay['furniture']>;
            slot.textContent = facts?.[key] || slot.dataset.lbFactsMissing || 'Not supplied for this variant.';
        }
        this.furniture.dataset.lbVariantFactsState = this.state;
        this.furniture.dataset.variantId = this.selected!.id!;
        if (status) {
            status.textContent = this.state === 'unavailable' ? this.status() : `${this.selectionLabel()} — selected variant facts.`;
        }
    }
    private renderOtherFacts() {
        if (!this.current) {
            return;
        }
        this.current.replaceChildren();
        this.current.dataset.variantId = this.selected?.id || '';
        this.current.dataset.selectionState = this.state;
        const status = this.node('p', this.status());
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.setAttribute('aria-atomic', 'true');
        this.current.append(status);
        const facts = this.selectedFacts();
        if (!facts) {
            return;
        }
        let count = 0;
        for (const namespace of Object.keys(DISPLAY_LABELS) as Array<keyof typeof DISPLAY_LABELS>) {
            if (namespace === 'furniture' && this.furniture) {
                continue;
            }
            const values = facts[namespace];
            if (!values) {
                continue;
            }
            const heading = this.node('h3', DOMAIN_LABELS[namespace]);
            const list = this.node('dl');
            for (const [key, label] of Object.entries(DISPLAY_LABELS[namespace])) {
                const value = values[key as keyof typeof values];
                if (typeof value !== 'string' || !value) {
                    continue;
                }
                const row = this.node('div');
                row.append(this.node('dt', label), this.node('dd', value));
                list.append(row);
                count++;
            }
            if (list.childNodes.length) {
                this.current.append(heading, list);
            }
        }
        if (!count) {
            this.current.append(this.node('p', 'Variant facts have not been supplied.'));
        }
    }
}
