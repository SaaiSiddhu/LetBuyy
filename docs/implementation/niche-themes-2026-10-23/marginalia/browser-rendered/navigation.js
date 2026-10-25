const LiquidIslandBase = HTMLElement;
const VARIANT_CHANGED_EVENT = 'letbuyy:variant:changed';
function readOptions(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return null;
    const fields = Object.getOwnPropertyDescriptors(value);
    const entries = Object.entries(fields);
    if (entries.length > 10)
        return null;
    const result = Object.create(null);
    for (const [key, field] of entries) {
        if (!key.length || key.length > 100 || !('value' in field) || typeof field.value !== 'string' || field.value.length > 100)
            return null;
        result[key] = field.value;
    }
    return result;
}
function parsePickerVariants(serialized) {
    if (!serialized || serialized.length > 1_048_576)
        return [];
    let rows;
    try {
        rows = JSON.parse(serialized);
    }
    catch {
        return [];
    }
    if (!Array.isArray(rows) || rows.length > 100)
        return [];
    return rows.flatMap((row) => {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            return [];
        const input = row;
        let options;
        if (Object.hasOwn(input, 'options_json')) {
            if (typeof input.options_json !== 'string' || input.options_json.length > 16384)
                return [];
            try {
                options = readOptions(JSON.parse(input.options_json));
            }
            catch {
                return [];
            }
        }
        else
            options = readOptions(input.options);
        if (!options || typeof input.id !== 'string' || !input.id || input.id.length > 100)
            return [];
        const number = (key) => typeof input[key] === 'number' && Number.isFinite(input[key]) && input[key] >= 0 ? input[key] : undefined;
        return [{ id: input.id, options, price: number('price'), stock: number('stock'), stock_quantity: number('stock_quantity'), inventory_qty: number('inventory_qty') }];
    });
}
function selectedVariantsFrom(root) {
    const selected = Object.create(null);
    const pressedOptions = root.querySelectorAll('[data-lb-variant-option][aria-pressed="true"]');
    pressedOptions.forEach((option) => {
        const name = option.dataset.variantName;
        const value = option.dataset.variantValue;
        if (name && value)
            selected[name] = value;
    });
    const inputs = root.querySelectorAll('[name^="variant["]');
    inputs.forEach((input) => {
        const match = input.name.match(/^variant\[(.+)]$/);
        if (match?.[1] && input.value)
            selected[match[1]] = input.value;
    });
    return selected;
}
function formatCartMoney(value, currency) {
    try {
        return value.toLocaleString('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 });
    }
    catch {
        return String(value);
    }
}
class LbMobileNavElement extends LiquidIslandBase {
    handleClick = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!target)
            return;
        if (target.closest('[data-lb-nav-toggle]')) {
            this.setOpen(this.dataset.open !== 'true');
            return;
        }
        if (target.closest('[data-lb-nav-close]') || target.closest('[data-lb-nav-scrim]') || target.closest('[data-lb-nav-panel] a')) {
            this.setOpen(false);
            return;
        }
        // Click outside an open desktop dropdown closes it (native <details> only closes another
        // <details> that shares its `name` group — these don't share one, since desktop dropdowns
        // must be able to be open independently, one per top-level item, hence this manual check).
        const clickedDropdown = target.closest('[data-lb-nav-dropdown]');
        this.querySelectorAll('[data-lb-nav-dropdown][open]').forEach((dropdown) => {
            if (dropdown !== clickedDropdown)
                dropdown.open = false;
        });
    };
    handleKeydown = (event) => {
        if (event.key === 'Escape') {
            const openDropdown = this.querySelector('[data-lb-nav-dropdown][open]');
            if (openDropdown) {
                openDropdown.open = false;
                openDropdown.querySelector('summary')?.focus();
                return;
            }
            if (this.dataset.open === 'true')
                this.setOpen(false);
            return;
        }
        if (this.dataset.open === 'true')
            this.trapTab(event);
        const withinDropdown = event.target?.closest('[data-lb-nav-dropdown][open]');
        if (withinDropdown && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            const links = Array.from(withinDropdown.querySelectorAll('.lb-header__nav-submenu a'));
            if (links.length === 0)
                return;
            const current = links.indexOf(document.activeElement);
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            const next = current === -1 ? 0 : ((current + delta) % links.length + links.length) % links.length;
            links[next]?.focus();
        }
    };
    // A real focus trap: while the drawer is open, Tab/Shift+Tab cycle only among the panel's own
    // focusable elements — previously Tab could walk focus straight out into the (visually hidden
    // behind the scrim, but still in the DOM and still focusable) rest of the page.
    trapTab(event) {
        if (event.key !== 'Tab')
            return;
        const panel = this.querySelector('[data-lb-nav-panel]');
        if (!panel)
            return;
        const focusable = Array.from(panel.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
        if (focusable.length === 0)
            return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
        else if (!panel.contains(active)) {
            event.preventDefault();
            first.focus();
        }
    }
    connectedCallback() {
        this.dataset.open = 'false';
        this.addEventListener('click', this.handleClick);
        this.addEventListener('keydown', this.handleKeydown);
    }
    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('keydown', this.handleKeydown);
        document.body.style.overflow = '';
    }
    setOpen(open) {
        this.dataset.open = open ? 'true' : 'false';
        const toggle = this.querySelector('[data-lb-nav-toggle]');
        toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
        // Body scroll lock while the drawer is open — a fixed-position off-canvas panel over a
        // scrollable page is otherwise disorienting on touch devices (the page keeps scrolling
        // behind the drawer). Reverts on close/disconnect.
        document.body.style.overflow = open ? 'hidden' : '';
        if (open) {
            const closeButton = this.querySelector('[data-lb-nav-close]');
            (closeButton || this.querySelector('[data-lb-nav-panel] a'))?.focus();
        }
        else {
            this.querySelectorAll('[data-lb-nav-dropdown][open]').forEach((d) => { d.open = false; });
            toggle?.focus();
        }
    }
}
class LbVariantPickerElement extends LiquidIslandBase {
    variants = [];
    handleClick = (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const option = target?.closest('[data-lb-variant-option]');
        if (!option)
            return;
        event.preventDefault();
        this.selectOption(option);
    };
    handleChange = () => {
        this.applyAvailability();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    };
    connectedCallback() {
        this.variants = parsePickerVariants(this.dataset.variants);
        this.addEventListener('click', this.handleClick);
        this.addEventListener('change', this.handleChange);
        this.applyAvailability();
    }
    disconnectedCallback() {
        this.removeEventListener('click', this.handleClick);
        this.removeEventListener('change', this.handleChange);
    }
    selectOption(option) {
        const name = option.dataset.variantName;
        const value = option.dataset.variantValue;
        if (!name || !value)
            return;
        this.querySelectorAll(`[data-lb-variant-option][data-variant-name="${CSS.escape(name)}"]`)
            .forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === option ? 'true' : 'false'));
        let hiddenInput = this.querySelector(`input[name="variant[${CSS.escape(name)}]"]`);
        if (!hiddenInput) {
            hiddenInput = document.createElement('input');
            hiddenInput.type = 'hidden';
            hiddenInput.name = `variant[${name}]`;
            this.appendChild(hiddenInput);
        }
        hiddenInput.value = value;
        this.applyAvailability();
        window.dispatchEvent(new CustomEvent(VARIANT_CHANGED_EVENT, { detail: selectedVariantsFrom(this) }));
    }
    // Only judges availability once every option group has a selection — a partial selection
    // (e.g. Size chosen, Colour not yet) cannot honestly be marked available or unavailable.
    applyAvailability() {
        if (this.variants.length === 0) {
            const status = this.querySelector('[data-lb-variant-status]');
            if (status)
                status.textContent = 'Product options are unavailable. Reload and try again.';
            this.dispatchAvailability(false);
            return;
        }
        const optionGroups = new Set(Array.from(this.querySelectorAll('[data-lb-variant-option]')).map((el) => el.dataset.variantName));
        const selected = selectedVariantsFrom(this);
        const fullySelected = optionGroups.size > 0 && Array.from(optionGroups).every((name) => name && selected[name]);
        const status = this.querySelector('[data-lb-variant-status]');
        if (!fullySelected) {
            if (status)
                status.textContent = 'Choose your options';
            this.dispatchAvailability(false);
            return;
        }
        const match = this.variants.find((variant) => {
            const options = variant.options || {};
            return Object.entries(selected).every(([name, value]) => options[name] === value);
        });
        const stock = match ? (match.stock ?? match.stock_quantity ?? match.inventory_qty ?? 0) : null;
        const available = Boolean(match?.id) && stock !== null && stock > 0;
        if (status)
            status.textContent = !available ? 'This combination is currently unavailable' : '';
        const price = this.closest('[data-section-id]')?.querySelector('.lb-product-detail__price-current');
        if (price && match?.price != null)
            price.textContent = formatCartMoney(match.price, this.closest('[data-section-id]')?.querySelector('lb-add-to-cart')?.dataset.productCurrency || 'INR');
        this.dispatchAvailability(available);
    }
    dispatchAvailability(available) {
        const section = this.closest('[data-section-id]') || document;
        section.querySelectorAll('[data-lb-add-to-cart],[data-lb-buy-now]').forEach((button) => {
            if (available)
                button.removeAttribute('disabled');
            else
                button.setAttribute('disabled', '');
        });
    }
}
customElements.define('lb-mobile-nav', LbMobileNavElement);
customElements.define('lb-variant-picker', LbVariantPickerElement);
