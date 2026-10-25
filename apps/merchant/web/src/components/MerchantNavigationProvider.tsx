'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Banner, Button, FormProtectionProvider, Modal, type FormProtection, type RegisterFormProtection } from '@letbuyy/ui'

type Departure = { proceed: () => void }
type NavigationContext = {
    request: (proceed: () => void) => void
    navigate: (href: string, replace?: boolean) => void
    setLinkPending: (id: string, pending: boolean) => void
    pending: boolean
}
const NavigationContext = createContext<NavigationContext | null>(null)
const active = (form: FormProtection) => form.dirty || Boolean(form.saving)
const flags = (form?: FormProtection | null) => form ? [form.dirty, form.saving, form.canSave, form.canDiscard, Boolean(form.onSave), Boolean(form.onDiscard)].join(':') : ''

// Navigation API traversal is cancellable before popstate. Older browsers retain
// native unload protection; record-specific recovery covers their termination limits.
interface TraversalEvent extends Event {
    navigationType: string
    destination: { key: string; url: string }
}
interface NavigationApi extends EventTarget { traverseTo: (key: string) => unknown }

export function MerchantNavigationProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const pathname = usePathname()
    const forms = useRef(new Map<string, FormProtection>())
    const links = useRef(new Set<string>())
    const [revision, setRevision] = useState(0)
    const [registeredForms, setRegisteredForms] = useState<FormProtection[]>([])
    const [pendingLinks, setPendingLinks] = useState(0)
    const [departure, setDeparture] = useState<Departure | null>(null)
    const [message, setMessage] = useState<string | null>(null)
    const [savingDeparture, setSavingDeparture] = useState(false)
    const [transitionPending, startTransition] = useTransition()
    const pendingSave = useRef<{ departure: Departure; finished: boolean } | null>(null)
    const allowTraversal = useRef<string | null>(null)
    const allowUnload = useRef(false)
    const previousPath = useRef(pathname)
    const protectedForms = registeredForms.filter(active)

    const register: RegisterFormProtection = useCallback((id, form) => {
        const old = forms.current.get(id)
        if (form) forms.current.set(id, form)
        else forms.current.delete(id)
        if (flags(old) !== flags(form)) {
            if (form && active(form)) allowUnload.current = false
            setRegisteredForms([...forms.current.values()])
            setRevision(value => value + 1)
        }
    }, [])
    const setLinkPending = useCallback((id: string, pending: boolean) => {
        const had = links.current.has(id)
        if (pending) links.current.add(id)
        else links.current.delete(id)
        if (had !== pending) setPendingLinks(links.current.size)
    }, [])
    const navigate = useCallback((href: string, replace = false) => {
        startTransition(() => replace ? router.replace(href) : router.push(href))
    }, [router])
    const request = useCallback((proceed: () => void) => {
        if ([...forms.current.values()].some(active)) {
            pendingSave.current = null
            setMessage(null)
            setDeparture({ proceed })
        } else proceed()
    }, [])

    useEffect(() => {
        function onClick(event: MouseEvent) {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
            const anchor = event.target instanceof window.Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
            if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return
            const destination = new URL(anchor.href, window.location.href)
            if (destination.origin !== window.location.origin || destination.href === window.location.href) return
            if (destination.pathname === window.location.pathname && destination.search === window.location.search) return
            if (![...forms.current.values()].some(active)) return
            event.preventDefault()
            event.stopPropagation()
            request(() => navigate(destination.pathname + destination.search + destination.hash))
        }
        function onUnload(event: BeforeUnloadEvent) {
            if (allowUnload.current) { allowUnload.current = false; return }
            if (![...forms.current.values()].some(active)) return
            event.preventDefault()
            event.returnValue = ''
        }
        const navigation = (window as Window & { navigation?: NavigationApi }).navigation
        function onTraverse(raw: Event) {
            const event = raw as TraversalEvent
            if (event.navigationType !== 'traverse' || !event.cancelable) return
            if (allowTraversal.current === event.destination.key) { allowTraversal.current = null; return }
            if (![...forms.current.values()].some(active)) return
            event.preventDefault()
            request(() => { allowTraversal.current = event.destination.key; navigation?.traverseTo(event.destination.key) })
        }
        document.addEventListener('click', onClick, true)
        window.addEventListener('beforeunload', onUnload)
        navigation?.addEventListener('navigate', onTraverse)
        return () => {
            document.removeEventListener('click', onClick, true)
            window.removeEventListener('beforeunload', onUnload)
            navigation?.removeEventListener('navigate', onTraverse)
        }
    }, [navigate, request])

    useEffect(() => {
        if (previousPath.current === pathname) return
        previousPath.current = pathname
        allowUnload.current = false
        pendingSave.current = null
        setDeparture(null)
        setMessage(null)
        const heading = document.querySelector<HTMLElement>('#admin-page-scroll h1')
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
    }, [pathname])

    useEffect(() => {
        const save = pendingSave.current
        if (!departure || savingDeparture || (save && !save.finished)) return
        if ([...forms.current.values()].some(form => form.saving)) return
        pendingSave.current = null
        if (![...forms.current.values()].some(active)) {
            setDeparture(null)
            allowUnload.current = true
            departure.proceed()
        } else if (save) setMessage('Your changes still need attention. Review the form before leaving.')
    }, [departure, revision, savingDeparture])

    const stay = () => { pendingSave.current = null; setDeparture(null); setMessage(null) }
    const discard = () => {
        const current = [...forms.current.values()].filter(active)
        if (!departure || current.some(form => form.saving || form.canDiscard === false || !form.onDiscard)) return
        try {
            for (const form of current) form.onDiscard?.()
            pendingSave.current = null
            setDeparture(null)
            allowUnload.current = true
            departure.proceed()
        } catch { setMessage('Your work could not be discarded safely. Keep this page open and review it.') }
    }
    const saveAndLeave = async () => {
        const current = [...forms.current.values()].filter(active)
        const form = current[0]
        if (!departure || current.length !== 1 || form.saving || form.canSave === false || !form.onSave) return
        const intent = { departure, finished: false }
        pendingSave.current = intent
        setMessage(null)
        setSavingDeparture(true)
        try { await form.onSave() }
        catch { setMessage('The save could not be confirmed. Review the form and its recovery actions.') }
        finally {
            intent.finished = true
            setSavingDeparture(false)
            setRevision(value => value + 1)
        }
    }
    const busy = savingDeparture || protectedForms.some(form => form.saving)
    const canDiscard = protectedForms.length > 0 && protectedForms.every(form => form.onDiscard && form.canDiscard !== false)
    const canSave = protectedForms.length === 1 && Boolean(protectedForms[0].onSave) && protectedForms[0].canSave !== false
    const pending = transitionPending || pendingLinks > 0

    return <NavigationContext.Provider value={{ request, navigate, setLinkPending, pending }}>
        <FormProtectionProvider register={register}>{children}</FormProtectionProvider>
        <Modal open={Boolean(departure)} title="Save your changes?"
            description="You have work on this page. Save it or discard it before leaving." onClose={stay}
            footer={<>
                <Button variant="secondary" onClick={stay}>Stay</Button>
                <Button variant="secondary" disabled={busy || !canDiscard} onClick={discard}>Discard and leave</Button>
                {canSave && <Button loading={busy} onClick={() => void saveAndLeave()}>Save and leave</Button>}
            </>}>
            {message ? <Banner variant="critical" title="Your work is kept">{message}</Banner>
                : <p>Staying on this page keeps your changes. An unconfirmed save must be recovered before you leave.</p>}
        </Modal>
    </NavigationContext.Provider>
}

export function useMerchantRouter() {
    const router = useRouter()
    const context = useContext(NavigationContext)
    return {
        ...router,
        push: (href: string) => context ? context.request(() => context.navigate(href)) : router.push(href),
        replace: (href: string) => context ? context.request(() => context.navigate(href, true)) : router.replace(href),
        back: () => context ? context.request(() => router.back()) : router.back(),
    }
}

export function useMerchantDeparture() {
    const context = useContext(NavigationContext)
    return (proceed: () => void) => context ? context.request(proceed) : proceed()
}

export function useMerchantLinkPending() { return useContext(NavigationContext)?.setLinkPending }

export function MerchantNavigationFeedback() {
    const pending = useContext(NavigationContext)?.pending ?? false
    return <div className="merchant-navigation-feedback" hidden={!pending} role="status" aria-live="polite">
        <span className="merchant-navigation-feedback-line" aria-hidden="true" />
        <span className="sr-only">Loading page</span>
    </div>
}
