const LiquidIslandBase = HTMLElement;
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
customElements.define('lb-mobile-nav', LbMobileNavElement);
