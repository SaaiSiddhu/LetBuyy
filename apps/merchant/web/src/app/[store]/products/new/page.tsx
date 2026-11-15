'use client'

import { PRODUCT_IMAGE_LIMIT } from '@letbuyy/commerce-core'
import {
    type VariantOption,
    type VariantRow,
    type ProductFormSnapshot,
    defaultProductSnapshot,
    buildVariantMatrix,
    appendVariantOptionValue,
    appendVariantOptionAxis,
    renameVariantOptionValue,
    renameVariantOptionName,
    normalizeApiVariants,
    weightUnitOptions,
    editStatusOptions,
    statusOptions,
    createFormSignature,
    type ProductEditIntent,
    publicMediaReference,
    retainProductMediaReferences,
    buildProductFormFields,
    readUnsavedProduct,
    restoreProductEdit,
    restoreProductInventory,
    keepCurrentProductInventory,
    rebaseProductInventoryAfterSave,
    generateHandle,
    getPayloadError,
    normalizeProductSnapshot,
} from '@/lib/product-form-state'
import { VariantFactsEditor } from '@/components/products/VariantFactsEditor'
import { ShippingProfilePicker } from '@/components/products/ShippingProfilePicker'
import { editVariantFacts, rebaseVariantFacts, variantFactsBaselineKnown, variantFactsValue } from '@/lib/variant-facts-draft'
import { NicheFactsEditor } from '@/components/products/NicheFactsEditor'
import { ApparelFactsEditor } from '@/components/products/ApparelFactsEditor'
import { composeProductMetadata, readProductFactsDraft, resolveProductGiftImages } from '@/lib/product-facts-draft'

import { useReadRequest } from '@/lib/api/use-read-request'
import { MediaRecoveryNotice, useMediaUploadTarget } from '@/components/media/MediaRecoveryProvider'
import { MediaLibrary } from '@/components/theme-editor/controls/MediaLibrary'
import { getStorefrontRootDomain } from '@/lib/public-urls'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MarketplaceReviewPanel, type MarketplaceListingStatus } from '@/components/products/MarketplaceReviewPanel'
import { useMerchantSecurityContext } from '@/components/security/MerchantSecurityContext'
import {
    keepMarketplaceResubmissionKeyForReason,
    retainMarketplaceResubmissionKey,
} from '@/lib/marketplace-resubmission-key'
import { Button, Input,
    ArrowLeft,
    ArrowRight,
    Badge,
    Banner,
    Card,
    Edit3,
    Image as ImageIcon,
    Modal,
    Package,
    Page,
    PageHeader,
    Plus,
    Save,
    SaveBar,
    Section,
    Select,
    Skeleton,
    Table,
    Textarea,
    Trash2,
    Upload,
    X,
    useToast,
    useFormProtection,
} from '@letbuyy/ui'
import { MerchantEmptyState as EmptyState } from '@/components/empty-states/MerchantEmptyState'

function CheckboxControl({
    checked,
    children,
    disabled,
    onChange,
    readOnly = false,
}: {
    checked: boolean
    children: ReactNode
    disabled?: boolean
    onChange?: (checked: boolean) => void
    readOnly?: boolean
}) {
    return (
        <label className="flex items-center gap-[var(--lb-space-2)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
            <Input unstyled
                type="checkbox"
                checked={checked}
                disabled={disabled}
                readOnly={readOnly}
                onChange={(event) => onChange?.(event.target.checked)}
                className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] accent-[var(--lb-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
            />
            {children}
        </label>
    )
}

export default function AddProductPage() {
    const { store, productId } = useParams<{ store: string; productId?: string }>()
    const { actorId } = useMerchantSecurityContext(store)
    const mediaUpload = useMediaUploadTarget(store, `${store}:${productId ?? 'new'}`)
    const [libraryOpen, setLibraryOpen] = useState(false)
    const router = useRouter()
    const { notify } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const titleInputRef = useRef<HTMLInputElement>(null)
    const isEditing = Boolean(productId && productId !== 'new')

    const [title, setTitle] = useState(defaultProductSnapshot.title)
    const [description, setDescription] = useState(defaultProductSnapshot.description)
    const [images, setImages] = useState<string[]>(defaultProductSnapshot.images)
    const [uploading, setUploading] = useState(false)
    const [category, setCategory] = useState(defaultProductSnapshot.category)
    const [price, setPrice] = useState(defaultProductSnapshot.price)
    const [comparePrice, setComparePrice] = useState(defaultProductSnapshot.comparePrice)
    const [costPerItem, setCostPerItem] = useState(defaultProductSnapshot.costPerItem)
    const [chargeTax, setChargeTax] = useState(defaultProductSnapshot.chargeTax)
    const [trackInventory, setTrackInventory] = useState(defaultProductSnapshot.trackInventory)
    const [quantity, setQuantity] = useState(defaultProductSnapshot.quantity)
    const [quantityBaseline, setQuantityBaseline] = useState<string | undefined>()
    const [quantityNeedsReview, setQuantityNeedsReview] = useState<boolean | undefined>()
    const acknowledgedProduct = useRef<ProductFormSnapshot | null>(null)
    const [sku, setSku] = useState(defaultProductSnapshot.sku)
    const [barcode, setBarcode] = useState(defaultProductSnapshot.barcode)
    const [sellWhenOos, setSellWhenOos] = useState(defaultProductSnapshot.sellWhenOos)
    const [isPhysical, setIsPhysical] = useState(defaultProductSnapshot.isPhysical)
    const [weight, setWeight] = useState(defaultProductSnapshot.weight)
    const [weightUnit, setWeightUnit] = useState(defaultProductSnapshot.weightUnit)
    const [shippingProfileId,setShippingProfileId]=useState<string|undefined>(undefined)
    const [countryOfOrigin, setCountryOfOrigin] = useState(defaultProductSnapshot.countryOfOrigin)
    const [importerDetails, setImporterDetails] = useState(defaultProductSnapshot.importerDetails)
    const [hsCode, setHsCode] = useState(defaultProductSnapshot.hsCode)
    const [variantOptions, setVariantOptions] = useState<VariantOption[]>(defaultProductSnapshot.variantOptions)
    const [variantMatrix, setVariantMatrix] = useState<VariantRow[]>(defaultProductSnapshot.variantMatrix)
    const [showVariantBuilder, setShowVariantBuilder] = useState(false)
    const [newOptionName, setNewOptionName] = useState('')
    const [newOptionValue, setNewOptionValue] = useState('')
    const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null)
    const [optionRename, setOptionRename] = useState<{ scope: string; optionIndex: number; valueIndex?: number; from: string; value: string; error?: string } | null>(null)
    const [seoTitle, setSeoTitle] = useState(defaultProductSnapshot.seoTitle)
    const [seoDescription, setSeoDescription] = useState(defaultProductSnapshot.seoDescription)
    const [urlHandle, setUrlHandle] = useState(defaultProductSnapshot.urlHandle)
    const [status, setStatus] = useState<ProductFormSnapshot['status']>(defaultProductSnapshot.status)
    const [productType, setProductType] = useState(defaultProductSnapshot.productType)
    const [vendor, setVendor] = useState(defaultProductSnapshot.vendor)
    const [apparelFacts, setApparelFacts] = useState(defaultProductSnapshot.apparelFacts)
    const [nicheFacts, setNicheFacts] = useState(defaultProductSnapshot.nicheFacts)
    const [giftMediaImageOrder, setGiftMediaImageOrder] = useState(defaultProductSnapshot.giftMediaImageOrder)
    const productMetadataRef = useRef<Record<string, unknown>>({})
    const [tags, setTags] = useState(defaultProductSnapshot.tags)
    const [saving, setSaving] = useState(false)
    const scopeKey = `${actorId}:${store}:${productId ?? 'new'}`
    const beginProductRead = useReadRequest(scopeKey)
    const beginConflictRead = useReadRequest(scopeKey)
    const beginMarketplaceRead = useReadRequest(scopeKey)
    const pendingStorageKey = `letbuyy.product-edit.v1:${scopeKey}`
    const draftStorageKey = `${pendingStorageKey}:unsaved`
    const [draftRecoveryReady, setDraftRecoveryReady] = useState(false)
    const [recoveredDraft, setRecoveredDraft] = useState<{ snapshot: ProductFormSnapshot; version: number | null } | null>(null)
    const [draftStorageError, setDraftStorageError] = useState<string | null>(null)
    const [draftReadBlocked, setDraftReadBlocked] = useState(false)
    const activeScope = useRef(scopeKey)
    activeScope.current = scopeKey
    const requestLifecycle = useRef({ mounted: false, generation: 0 })
    useEffect(() => {
        const lifecycle = requestLifecycle.current
        lifecycle.mounted = true
        lifecycle.generation += 1
        return () => {
            lifecycle.mounted = false
            lifecycle.generation += 1
        }
    }, [scopeKey])
    const loadedScope = useRef<string | null>(null)
    const [productVersion, setProductVersion] = useState<number | null>(null)
    const [editBlocked, setEditBlocked] = useState(false)
    const [contextChanged, setContextChanged] = useState(false)
    const [productConflict, setProductConflict] = useState<Record<string, unknown> | null>(null)
    const editIntent = useRef<ProductEditIntent | null>(null)
    const [loadingProduct, setLoadingProduct] = useState(isEditing)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [marketplaceListing, setMarketplaceListing] = useState<MarketplaceListingStatus | null>(null)
    const [marketplaceListingLoaded, setMarketplaceListingLoaded] = useState(false)
    const [marketplaceCorrection, setMarketplaceCorrection] = useState('')
    const [marketplaceCorrectionError, setMarketplaceCorrectionError] = useState<string | null>(null)
    const [resubmittingMarketplaceListing, setResubmittingMarketplaceListing] = useState(false)
    const marketplaceResubmitKey = useRef<ReturnType<typeof retainMarketplaceResubmissionKey> | null>(null)
    const [savedSignature, setSavedSignature] = useState<string | null>(() => (
        isEditing ? null : createFormSignature(defaultProductSnapshot)
    ))

    const resolvedGiftDraft = resolveProductGiftImages(nicheFacts, productMetadataRef.current, giftMediaImageOrder, images)
    const currentSnapshot = useMemo<ProductFormSnapshot>(() => ({
        apparelFacts,
        nicheFacts: resolvedGiftDraft.value,
        giftMediaImageOrder: resolvedGiftDraft.imageOrder,
        title,
        description,
        images,
        category,
        price,
        comparePrice,
        costPerItem,
        chargeTax,
        trackInventory,
        quantity,
        quantityBaseline,
        quantityNeedsReview,
        sku,
        barcode,
        sellWhenOos,
        isPhysical,
        weight,
        weightUnit,
        shippingProfileId,
        countryOfOrigin,
        importerDetails,
        hsCode,
        variantOptions,
        variantMatrix,
        seoTitle,
        seoDescription,
        urlHandle,
        status,
        productType,
        vendor,
        tags,
    }), [
        apparelFacts,
        resolvedGiftDraft.value,
        resolvedGiftDraft.imageOrder,
        barcode,
        category,
        chargeTax,
        comparePrice,
        costPerItem,
        countryOfOrigin,
        importerDetails,
        description,
        hsCode,
        images,
        isPhysical,
        price,
        productType,
        quantity,
        quantityBaseline,
        quantityNeedsReview,
        sellWhenOos,
        seoDescription,
        seoTitle,
        sku,
        status,
        tags,
        title,
        trackInventory,
        urlHandle,
        variantMatrix,
        variantOptions,
        vendor,
        weight,
        weightUnit,
        shippingProfileId,
    ])

    const currentSignature = useMemo(() => createFormSignature(currentSnapshot), [currentSnapshot])
    const recoverySignature = useMemo(() => createFormSignature(retainProductMediaReferences(currentSnapshot)), [currentSnapshot])
    const latestProductDraft = useRef(currentSnapshot)
    latestProductDraft.current = currentSnapshot
    const latestSignature = useRef(currentSignature)
    latestSignature.current = currentSignature
    const latestVariants = useRef(variantMatrix)
    latestVariants.current = variantMatrix
    const hasUnsavedChanges = Boolean(editIntent.current?.scope === scopeKey || (savedSignature && currentSignature !== savedSignature))
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'
    const saveBlocked = isEditing && (editBlocked || productVersion === null || loadedScope.current !== scopeKey)
    const forgetEditIntent = useCallback((expectedIntent: ProductEditIntent | null = editIntent.current) => {
        const stored = window.sessionStorage.getItem(pendingStorageKey)
        if (expectedIntent && stored !== null) {
            // A different editor instance may already be retaining a newer save.
            // Draft changes do not alter the identity of the immutable command.
            const retained: unknown = JSON.parse(stored)
            if (!retained || typeof retained !== 'object'
                || !['scope', 'key', 'version', 'signature', 'variantSignature', 'hasNewVariants', 'payload']
                    .every(field => (retained as Record<string, unknown>)[field] === expectedIntent[field as keyof ProductEditIntent])) {
                throw new Error('Another pending save is retained. Reload and review it before clearing this request.')
            }
        }
        window.sessionStorage.removeItem(pendingStorageKey)
        if (editIntent.current === expectedIntent) editIntent.current = null
    }, [pendingStorageKey])

    useEffect(() => {
        if (editIntent.current?.scope !== scopeKey) return
        try {
            window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({ ...editIntent.current, draftSignature: recoverySignature }))
        } catch {
            setError('Your newer draft could not be retained across reload. Keep this page open and recover the pending save.')
        }
    }, [recoverySignature, pendingStorageKey, scopeKey])

    const updateProductImages = useCallback((update: (previous: string[]) => string[]) => {
        if (!requestLifecycle.current.mounted || activeScope.current !== scopeKey) return false
        const before = latestProductDraft.current
        const next = update(before.images)
        // Retained oversized drafts can still be reduced or reordered. Never
        // truncate their media or begin growing beyond the canonical API bound.
        if (next.length > PRODUCT_IMAGE_LIMIT && next.length > before.images.length) return false
        const resolved = resolveProductGiftImages(before.nicheFacts, productMetadataRef.current, before.giftMediaImageOrder, next)
        setImages(next)
        setNicheFacts(resolved.value)
        setGiftMediaImageOrder(resolved.imageOrder)
        latestProductDraft.current = { ...before, images: next, nicheFacts: resolved.value, giftMediaImageOrder: resolved.imageOrder }
        return true
    }, [scopeKey])

    const updateProductFacts = (next: string) => {
        const order = next === '' || resolvedGiftDraft.issue ? '' : JSON.stringify(images)
        setNicheFacts(next)
        setGiftMediaImageOrder(order)
        latestProductDraft.current = { ...currentSnapshot, nicheFacts: next, giftMediaImageOrder: order }
    }

    const applySnapshot = useCallback((snapshot: ProductFormSnapshot) => {
        setTitle(snapshot.title)
        setDescription(snapshot.description)
        setImages(snapshot.images)
        setCategory(snapshot.category)
        setPrice(snapshot.price)
        setComparePrice(snapshot.comparePrice)
        setCostPerItem(snapshot.costPerItem)
        setChargeTax(snapshot.chargeTax)
        setTrackInventory(snapshot.trackInventory)
        setQuantity(snapshot.quantity)
        setQuantityBaseline(snapshot.quantityBaseline)
        setQuantityNeedsReview(snapshot.quantityNeedsReview)
        setSku(snapshot.sku)
        setBarcode(snapshot.barcode)
        setSellWhenOos(snapshot.sellWhenOos)
        setIsPhysical(snapshot.isPhysical)
        setWeight(snapshot.weight)
        setWeightUnit(snapshot.weightUnit)
        setShippingProfileId(snapshot.shippingProfileId)
        setCountryOfOrigin(snapshot.countryOfOrigin)
        setImporterDetails(snapshot.importerDetails)
        setHsCode(snapshot.hsCode)
        setVariantOptions(snapshot.variantOptions)
        setVariantMatrix(snapshot.variantMatrix)
        setOptionRename(null)
        setSeoTitle(snapshot.seoTitle)
        setSeoDescription(snapshot.seoDescription)
        setUrlHandle(snapshot.urlHandle)
        setStatus(snapshot.status)
        setProductType(snapshot.productType)
        setVendor(snapshot.vendor)
        setTags(snapshot.tags)
        setApparelFacts(snapshot.apparelFacts ?? '{}')
        setNicheFacts(snapshot.nicheFacts ?? '')
        setGiftMediaImageOrder(snapshot.giftMediaImageOrder ?? '')
        setSavedSignature(createFormSignature(snapshot))
    }, [])

    useEffect(() => {
        if (isEditing) return
        try {
            const raw = window.sessionStorage.getItem(draftStorageKey)
            if (raw) setRecoveredDraft(readUnsavedProduct(raw, scopeKey))
        } catch { setDraftReadBlocked(true); setDraftStorageError('A retained draft could not be read. Keep this page open or discard the retained draft.') }
        setDraftRecoveryReady(true)
    }, [draftStorageKey, isEditing, scopeKey])

    useEffect(() => {
        if (!draftRecoveryReady || draftReadBlocked || recoveredDraft || (isEditing && loadedScope.current !== scopeKey) || editIntent.current?.scope === scopeKey) return
        try {
            if (!hasUnsavedChanges) window.sessionStorage.removeItem(draftStorageKey)
            else {
                const snapshot = retainProductMediaReferences({ ...currentSnapshot, importerDetails: '' })
                const retained = JSON.stringify({ scope: scopeKey, version: productVersion, updatedAt: Date.now(), snapshot })
                if (retained.length > 256_000) throw new Error('Draft too large')
                window.sessionStorage.setItem(draftStorageKey, retained)
            }
            setDraftStorageError(null)
        } catch { setDraftStorageError('Your draft could not be retained across reload. Keep this page open until you save or discard it.') }
    }, [currentSnapshot, draftReadBlocked, draftRecoveryReady, draftStorageKey, hasUnsavedChanges, isEditing, productVersion, recoveredDraft, scopeKey])

    const loadProduct = useCallback(async () => {
        if (!isEditing || !productId) return
        const request = beginProductRead()
        const requestScope = scopeKey
        const requestGeneration = requestLifecycle.current.generation
        setLoadingProduct(true)
        setDraftRecoveryReady(false)
        setDraftReadBlocked(false)
        setRecoveredDraft(null)
        setProductVersion(null)
        loadedScope.current = null
        acknowledgedProduct.current = null
        editIntent.current = null
        setProductConflict(null)
        setEditBlocked(false)
        setContextChanged(false)
        setSaving(false)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(productId)}`, { cache: 'no-store', signal: request.signal, headers: { 'X-LetBuyy-Merchant-Context': actorId } })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent() || !requestLifecycle.current.mounted || requestLifecycle.current.generation !== requestGeneration || activeScope.current !== requestScope) return

            if (!response.ok || !payload?.data) {
                throw new Error(getPayloadError(payload, 'Unable to load product'))
            }
            if (!Number.isInteger(payload.data.version) || payload.data.version <= 0 || payload.data.id !== productId) {
                throw new Error('The current product version could not be loaded. Retry before saving.')
            }
            loadedScope.current = requestScope
            setProductVersion(payload.data.version)
            acknowledgedProduct.current = normalizeProductSnapshot(payload.data as Record<string, unknown>)
            productMetadataRef.current = payload.data.metadata && typeof payload.data.metadata === 'object' ? payload.data.metadata : {}
            const stored = window.sessionStorage.getItem(pendingStorageKey)
            if (stored !== null) {
                const recovered = restoreProductEdit(stored, requestScope)
                editIntent.current = recovered.intent
                applySnapshot(recovered.draft)
                setSavedSignature(recovered.intent.signature)
                setError('An earlier save still needs confirmation. Retry pending save to recover it; your draft is kept.')
            } else {
                productMetadataRef.current = payload.data.metadata && typeof payload.data.metadata === 'object' ? payload.data.metadata : {}
                applySnapshot(acknowledgedProduct.current)
                try {
                    const raw = window.sessionStorage.getItem(draftStorageKey)
                    if (raw) setRecoveredDraft(readUnsavedProduct(raw, requestScope))
                } catch { setDraftReadBlocked(true); setDraftStorageError('A retained draft could not be read. Discard the retained draft before continuing.') }
            }
            setDraftRecoveryReady(true)
        } catch (err) {
            if (!request.isCurrent() || !requestLifecycle.current.mounted || requestLifecycle.current.generation !== requestGeneration || activeScope.current !== requestScope) return
            setEditBlocked(true)
            const message = err instanceof Error ? err.message : 'Unable to load product'
            setError(message)
            notify({
                title: 'Product could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (request.isCurrent() && requestLifecycle.current.mounted && requestLifecycle.current.generation === requestGeneration && activeScope.current === requestScope) setLoadingProduct(false)
        }
    }, [beginProductRead, actorId, applySnapshot, draftStorageKey, isEditing, notify, pendingStorageKey, productId, store, scopeKey])

    useEffect(() => {
        void loadProduct()
    }, [loadProduct])

    const loadMarketplaceListing = useCallback(async () => {
        if (!isEditing || !productId) return
        const request = beginMarketplaceRead()
        setMarketplaceListingLoaded(false)
        setMarketplaceListing(null)
        setMarketplaceCorrectionError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/marketplace-listings/${encodeURIComponent(productId)}`, { cache: 'no-store', signal: request.signal })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent()) return
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to load marketplace review status'))
            setMarketplaceListing(payload?.data && typeof payload.data === 'object' ? payload.data as MarketplaceListingStatus : null)
        } catch (err) {
            if (!request.isCurrent()) return
            setMarketplaceCorrectionError(err instanceof Error ? err.message : 'Unable to load marketplace review status')
        } finally {
            if (request.isCurrent()) setMarketplaceListingLoaded(true)
        }
    }, [beginMarketplaceRead, isEditing, productId, store])

    useEffect(() => {
        void loadMarketplaceListing()
    }, [loadMarketplaceListing])

    const resubmitMarketplaceListing = async () => {
        if (!productId || !marketplaceListing || marketplaceListing.status !== 'rejected') return
        if (hasUnsavedChanges) {
            setMarketplaceCorrectionError('Save the corrected product first, then resubmit it for review.')
            return
        }
        const reason = marketplaceCorrection.trim()
        if (reason.length < 8 || reason.length > 500) {
            setMarketplaceCorrectionError('Describe the corrections in 8 to 500 characters.')
            return
        }
        marketplaceResubmitKey.current = retainMarketplaceResubmissionKey(
            marketplaceResubmitKey.current,
            reason,
            () => crypto.randomUUID(),
        )
        setResubmittingMarketplaceListing(true)
        setMarketplaceCorrectionError(null)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/marketplace-listings/${encodeURIComponent(productId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, idempotency_key: marketplaceResubmitKey.current.key }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) throw new Error(getPayloadError(payload, 'Unable to resubmit marketplace listing'))
            marketplaceResubmitKey.current = null
            setMarketplaceCorrection('')
            await loadMarketplaceListing()
            notify({ title: 'Marketplace listing resubmitted', description: 'The corrected product revision is back in the review queue.', variant: 'success' })
        } catch (err) {
            setMarketplaceCorrectionError(err instanceof Error ? err.message : 'Unable to resubmit marketplace listing')
        } finally {
            setResubmittingMarketplaceListing(false)
        }
    }

    const handleTitleChange = (value: string) => {
        setTitle(value)
        if (!urlHandle || urlHandle === generateHandle(title)) {
            setUrlHandle(generateHandle(value))
        }
    }

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files ?? [])
        event.target.value = ''
        if (!files.length || mediaUpload.blocked) return
        const generation = requestLifecycle.current.generation
        const current = () => requestLifecycle.current.mounted && requestLifecycle.current.generation === generation && activeScope.current === scopeKey
        if (!current()) return
        const remaining = Math.max(0, PRODUCT_IMAGE_LIMIT - latestProductDraft.current.images.length)
        if (files.length > remaining) {
            notify({ title: remaining ? 'Choose fewer images' : 'Image limit reached', description: `This product can accept ${remaining} more image${remaining === 1 ? '' : 's'}. Products support up to ${PRODUCT_IMAGE_LIMIT} images.`, variant: 'warning' })
            return
        }
        setUploading(true)
        try {
            for (const file of files) {
                const asset = await mediaUpload.upload(file)
                if (!current()) return
                if (!updateProductImages(previous => [...previous, asset.url])) {
                    notify({ title: 'Image saved to Media library', description: `This product already has ${PRODUCT_IMAGE_LIMIT} images. Remove an image before attaching another.`, variant: 'warning' })
                    return
                }
            }
            if (current()) notify({ title: 'Images added', description: 'Save the product to keep these media changes.', variant: 'success' })
        } catch (error) {
            if (current()) notify({ title: 'Media needs confirmation', description: error instanceof Error ? error.message : 'Confirm the saved request before another upload.', variant: 'warning' })
        } finally { if (current()) setUploading(false) }
    }

    const selectLibraryImage = (url: string) => {
        if (!requestLifecycle.current.mounted || activeScope.current !== scopeKey) return
        if (latestProductDraft.current.images.includes(url)) {
            notify({ title: 'Image already attached', description: 'Choose another image from the library.', variant: 'warning' })
            return
        }
        if (!updateProductImages(previous => [...previous, url])) {
            notify({ title: 'Image limit reached', description: `Products support up to ${PRODUCT_IMAGE_LIMIT} images. Remove an image before adding another.`, variant: 'warning' })
        }
    }

    const removeImage = (index: number) => {
        updateProductImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))
    }

    const moveImage = (from: number, to: number) => updateProductImages(previous => {
        if (to < 0 || to >= previous.length) return previous
        const next = [...previous]
        const moved = next[from]
        next[from] = next[to]
        next[to] = moved
        return next
    })

    const rebuildMatrix = (nextOptions: VariantOption[], addition?: { index: number; value: string }) => {
        try {
            const nextMatrix = addition ? appendVariantOptionValue(variantOptions, addition.index, addition.value, price, variantMatrix) : buildVariantMatrix(nextOptions, price, variantMatrix)
            setVariantOptions(nextOptions)
            setVariantMatrix(nextMatrix)
            setError(null)
            return true
        } catch (error) { setError(error instanceof Error ? error.message : 'Review variant combinations before rebuilding.'); return false }
    }

    const addVariantOption = () => {
        const optionName = newOptionName.trim()
        if (!optionName) return
        try { setVariantOptions(appendVariantOptionAxis(variantOptions, optionName, variantMatrix)); setError(null) }
        catch (error) { setError(error instanceof Error ? error.message : 'Review variant options.'); return }
        setEditingOptionIndex(variantOptions.length)
        setNewOptionName('')
        setShowVariantBuilder(false)
    }

    const addValueToOption = (optionIndex: number) => {
        const optionValue = newOptionValue.trim()
        if (optionValue && rebuildMatrix(variantOptions.map((option, index) => index === optionIndex ? { ...option, values: [...option.values, optionValue] } : option), { index: optionIndex, value: optionValue })) setNewOptionValue('')
    }

    const removeValueFromOption = (optionIndex: number, valueIndex: number) => {
        rebuildMatrix(variantOptions.map((option, index) => index === optionIndex ? { ...option, values: option.values.filter((_, current) => current !== valueIndex) } : option))
    }

    const removeOption = (index: number) => {
        if (rebuildMatrix(variantOptions.filter((_, optionIndex) => optionIndex !== index)) && editingOptionIndex === index) setEditingOptionIndex(null)
    }

    const renameOptionValue = () => {
        if (!optionRename || saving || loadingProduct || editBlocked || contextChanged) return
        try {
            if (optionRename.valueIndex === undefined) {
                if (optionRename.scope !== scopeKey || variantOptions[optionRename.optionIndex]?.name !== optionRename.from) throw new Error('This option has changed. Close and review the latest names.')
                setVariantOptions(renameVariantOptionName(variantOptions, optionRename.optionIndex, optionRename.value, variantMatrix))
                setOptionRename(null)
                return
            }
            if (optionRename.scope !== scopeKey || variantOptions[optionRename.optionIndex]?.values[optionRename.valueIndex] !== optionRename.from) throw new Error('This option value has changed. Close and review the latest values.')
            const next = renameVariantOptionValue(variantOptions, optionRename.optionIndex, optionRename.valueIndex, optionRename.value, variantMatrix)
            setVariantOptions(next.options); setVariantMatrix(next.rows); setOptionRename(null)
        } catch (error) { setOptionRename({ ...optionRename, error: error instanceof Error ? error.message : 'Review this option value.' }) }
    }

    let commonVariantFacts: unknown
    try { commonVariantFacts = readProductFactsDraft(currentSnapshot.nicheFacts, productMetadataRef.current) } catch { /* Invalid common facts remain in their product editor. */ }
    const updateVariantFacts = (row: VariantRow, metadata: Record<string, unknown>) => {
        setVariantMatrix(previous => previous.map(candidate => (row.id ? candidate.id === row.id : candidate === row) ? editVariantFacts(candidate, metadata) : candidate))
    }

    const checkLatestProduct = useCallback(async () => {
        if (!productId) return
        const request = beginConflictRead()
        const requestScope = scopeKey
        const requestGeneration = requestLifecycle.current.generation
        setProductConflict(null)
        setEditBlocked(true)
        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(productId)}`, { cache: 'no-store', signal: request.signal, headers: { 'X-LetBuyy-Merchant-Context': actorId } })
            const payload = await response.json().catch(() => null)
            if (!request.isCurrent() || !requestLifecycle.current.mounted || requestLifecycle.current.generation !== requestGeneration || activeScope.current !== requestScope) return
            if (!response.ok || !payload?.data || payload.data.id !== productId || !Number.isInteger(payload.data.version) || payload.data.version <= 0) {
                throw new Error(getPayloadError(payload, 'The latest product could not be checked. Your draft is kept.'))
            }
            setProductConflict(payload.data)
        } catch (error) {
            if (request.isCurrent() && requestLifecycle.current.mounted && requestLifecycle.current.generation === requestGeneration && activeScope.current === requestScope) setError(error instanceof Error ? error.message : 'The latest product could not be checked. Your draft is kept.')
        }
    }, [beginConflictRead, actorId, productId, scopeKey, store])

    const reloadLatestProduct = () => {
        if (!productConflict || !Number.isInteger(productConflict.version) || Number(productConflict.version) <= 0) return
        try { forgetEditIntent() } catch { setError('The pending save could not be cleared. Keep this page open and retry.'); return }
        productMetadataRef.current = productConflict.metadata && typeof productConflict.metadata === 'object' && !Array.isArray(productConflict.metadata) ? productConflict.metadata as Record<string, unknown> : {}
        acknowledgedProduct.current = normalizeProductSnapshot(productConflict)
        applySnapshot(acknowledgedProduct.current)
        setProductVersion(Number(productConflict.version))
        loadedScope.current = scopeKey
        setProductConflict(null)
        setEditBlocked(false)
        setError(null)
        setSuccess(null)
    }

    const handleSave = useCallback(async (stayOnPage = false) => {
        const requestScope = scopeKey
        const requestGeneration = requestLifecycle.current.generation
        const pending = editIntent.current?.scope === requestScope ? editIntent.current : null
        if (saving || contextChanged || (isEditing && saveBlocked && !pending)) return
        const productTitle = title.trim()
        if (!pending && !productTitle) {
            const message = 'Add a product title before saving.'
            setError(message)
            if (!document.querySelector('[aria-modal="true"]')) titleInputRef.current?.focus()
            notify({
                title: 'Product title is required',
                description: message,
                variant: 'warning',
            })
            return
        }

        setSaving(true)
        setError(null)
        setSuccess(null)

        try {
            const endpoint = isEditing && productId
                ? `/api/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(productId)}`
                : `/api/stores/${encodeURIComponent(store)}/products`

            if (!pending && resolvedGiftDraft.issue) throw new Error(resolvedGiftDraft.issue)
            if (!pending && images.some(image => !publicMediaReference(image))) throw new Error('Use public product image URLs before saving. Your draft is kept.')
            const fields = pending ? undefined : buildProductFormFields(currentSnapshot, composeProductMetadata(productMetadataRef.current, apparelFacts, currentSnapshot.nicheFacts), isEditing)
            let intent = pending
            if (isEditing && !intent) {
                const key = crypto.randomUUID()
                intent = { scope: requestScope, key, version: productVersion!, signature: currentSignature,
                    variantSignature: JSON.stringify(variantMatrix), hasNewVariants: variantMatrix.some(row => !row.id),
                    payload: JSON.stringify({ ...fields, status, version: productVersion, idempotency_key: key }) }
            }
            if (intent) {
                // Persist the immutable command before allowing its first effect.
                // Later draft edits update only draftSignature, never this payload/key.
                try { window.sessionStorage.setItem(pendingStorageKey, JSON.stringify({ ...intent, draftSignature: recoverySignature })) }
                catch { throw new Error('This browser could not retain the save request. Allow session storage before saving.') }
                editIntent.current = intent
            }
            const response = await fetch(endpoint, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json', ...(intent ? { 'X-LetBuyy-Merchant-Context': actorId, 'X-Idempotency-Key': intent.key } : {}) },
                body: intent?.payload ?? JSON.stringify(fields),
            })

            const payload = await response.json().catch(() => null)
            if (!requestLifecycle.current.mounted || requestLifecycle.current.generation !== requestGeneration || activeScope.current !== requestScope) return

            if (!response.ok) {
                if (isEditing && payload?.error?.code === 'SESSION_CONTEXT_CHANGED') { setContextChanged(true); setEditBlocked(true) }
                if (isEditing && response.status < 500) forgetEditIntent(intent)
                if (isEditing && (['PRODUCT_VERSION_CONFLICT', 'PRODUCT_EDIT_KEY_CONFLICT', 'PRODUCT_VARIANT_IN_USE'].includes(payload?.error?.code))) {
                    await checkLatestProduct()
                } else if (isEditing && [401, 403, 404].includes(response.status)) {
                    setEditBlocked(true)
                }
                throw new Error(getPayloadError(payload, 'Failed to save product'))
            }

            if (isEditing) {
                if (!payload?.data || payload.data.id !== productId || !Number.isInteger(payload.data.version) || payload.data.version <= 0) {
                    throw new Error('The save response could not be confirmed. Retry the pending save.')
                }
                setProductVersion(payload.data.version)
                loadedScope.current = requestScope
                forgetEditIntent(intent)
                const acknowledged = normalizeProductSnapshot(payload.data as Record<string, unknown>)
                acknowledgedProduct.current = acknowledged
                const newerDraft = intent?.signature !== latestSignature.current
                if (!newerDraft) {
                    productMetadataRef.current = payload.data.metadata && typeof payload.data.metadata === 'object' ? payload.data.metadata : {}
                    applySnapshot(acknowledged)
                } else {
                    const rebased = rebaseProductInventoryAfterSave(latestProductDraft.current, JSON.parse(intent!.signature) as ProductFormSnapshot, acknowledged)
                    setQuantity(rebased.quantity)
                    setQuantityBaseline(rebased.quantityBaseline)
                    setQuantityNeedsReview(rebased.quantityNeedsReview)
                    setSavedSignature(createFormSignature(acknowledged))
                    if (intent?.variantSignature === JSON.stringify(latestVariants.current)) {
                        setVariantMatrix(normalizeApiVariants(payload.data.variants))
                    } else {
                        setVariantMatrix(rebaseVariantFacts(rebased.variantMatrix, payload.data.variants))
                        if (intent?.hasNewVariants) void checkLatestProduct()
                    }
                }
                setSuccess(newerDraft ? 'The earlier save is confirmed. Your newer draft is kept; review it and save again.' : 'Product saved')
                notify({
                    title: 'Product saved',
                    description: newerDraft ? 'Your newer draft still needs saving.' : `${productTitle} is up to date.`,
                    variant: 'success',
                })
            } else {
                setSavedSignature(currentSignature)
                window.sessionStorage.removeItem(draftStorageKey)
                notify({
                    title: 'Product created',
                    description: `${productTitle} was added to your catalog.`,
                    variant: 'success',
                })
                if (!stayOnPage) router.push(`/${store}/products`)
            }
        } catch (err: unknown) {
            if (!requestLifecycle.current.mounted || requestLifecycle.current.generation !== requestGeneration || activeScope.current !== requestScope) return
            const message = editIntent.current?.scope === requestScope
                ? 'The save result is not confirmed. Retry pending save to recover it. Your draft is kept.'
                : err instanceof Error ? err.message : 'Failed to save product'
            setError(message)
            notify({
                title: 'Could not save product',
                description: message,
                variant: 'critical',
            })
        } finally {
            if (requestLifecycle.current.mounted && requestLifecycle.current.generation === requestGeneration && activeScope.current === requestScope) setSaving(false)
        }
    }, [apparelFacts, currentSnapshot, resolvedGiftDraft.issue, recoverySignature,
        actorId,
        draftStorageKey,
        applySnapshot,
        checkLatestProduct,
        contextChanged,
        forgetEditIntent,
        pendingStorageKey,
        productVersion,
        saveBlocked,
        saving,
        scopeKey,
        currentSignature,
        images,
        isEditing,
        notify,
        productId,
        router,
        status,
        store,
        title,
        variantMatrix,
    ])

    const discardDraft = useCallback(() => {
        if (saving || editIntent.current?.scope === scopeKey) return
        window.sessionStorage.removeItem(draftStorageKey)
        setRecoveredDraft(null)
        if (savedSignature) applySnapshot(JSON.parse(savedSignature) as ProductFormSnapshot)
    }, [applySnapshot, draftStorageKey, savedSignature, saving, scopeKey])

    const discardChanges = useCallback(() => {
        if (saving || editIntent.current?.scope === scopeKey) return
        try { discardDraft(); router.push(`/${store}/products`) }
        catch { setError('Your retained draft could not be discarded safely. Keep this page open and try again.') }
    }, [discardDraft, router, saving, scopeKey, store])

    useFormProtection({
        dirty: hasUnsavedChanges,
        saving,
        onSave: () => handleSave(true),
        onDiscard: discardDraft,
        canSave: !contextChanged && (!saveBlocked || editIntent.current?.scope === scopeKey),
        canDiscard: !contextChanged && editIntent.current?.scope !== scopeKey,
    })

    if (loadingProduct) {
        return (
            <Page>
                <PageHeader identity="products"
                    recipe="editor"
                    title="Edit product"
                    description="Loading product details."
                    breadcrumbs={[{ label: 'Products', href: `/${store}/products` }, { label: 'Edit product' }]}
                    secondaryActions={[{
                        label: 'Back to products',
                        href: `/${store}/products`,
                        icon: <ArrowLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    }]}
                />
                <Card>
                    <Section>
                        <Skeleton variant="card" />
                    </Section>
                </Card>
            </Page>
        )
    }

    return (
        <Page>
            <PageHeader identity="products"
                recipe="editor"
                title={isEditing ? 'Edit product' : 'Add product'}
                description={isEditing ? 'Update product details, media, pricing, inventory, and search metadata.' : 'Create a catalog-ready product with the details shoppers need.'}
                breadcrumbs={[{ label: 'Products', href: `/${store}/products` }, { label: isEditing ? 'Edit product' : 'Add product' }]}
                primaryAction={saveState === 'saved' || saveBlocked ? {
                    label: saving ? 'Saving' : editIntent.current?.scope === scopeKey ? 'Retry pending save' : 'Save product',
                    onClick: () => void handleSave(),
                    icon: <Save className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    disabled: !hasUnsavedChanges || saving || saveBlocked,
                    loading: saving,
                } : undefined}
                secondaryActions={saveState === 'saved' || saveBlocked ? [{
                    label: 'Discard',
                    onClick: discardChanges,
                    icon: <ArrowLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    disabled: saving || editIntent.current?.scope === scopeKey,
                }] : []}
            />

            {recoveredDraft && <Banner variant="warning" title="Unsaved product draft found">
                <p>{recoveredDraft.version !== productVersion ? 'The saved product has changed since this draft. Review both versions before saving.' : 'You can restore your unsaved catalog fields.'} Recheck media and importer details after restoring.</p>
                <Button onClick={() => {
                    const baseline = savedSignature
                    const importerDetails = currentSnapshot.importerDetails
                    const retained = isEditing && acknowledgedProduct.current ? restoreProductInventory(recoveredDraft.snapshot, acknowledgedProduct.current) : recoveredDraft.snapshot
                    applySnapshot({ ...retained, importerDetails })
                    setSavedSignature(baseline)
                    setRecoveredDraft(null)
                }}>Restore draft</Button>
                <Button variant="secondary" onClick={() => {
                    try { window.sessionStorage.removeItem(draftStorageKey); setRecoveredDraft(null); setDraftStorageError(null) }
                    catch { setDraftStorageError('The retained draft could not be removed. Keep this page open.') }
                }}>Discard retained draft</Button>
            </Banner>}
            {draftStorageError && <Banner variant="warning" title="Draft recovery needs attention">{draftStorageError}
                <Button variant="secondary" onClick={() => {
                    try { window.sessionStorage.removeItem(draftStorageKey); setDraftReadBlocked(false); setDraftStorageError(null) }
                    catch { setDraftStorageError('The retained draft could not be removed. Keep this page open.') }
                }}>Discard retained draft</Button>
            </Banner>}

            {isEditing && (quantityNeedsReview || variantMatrix.some(row => row.id && row.stockNeedsReview)) && <Banner variant="warning" title="Review retained inventory">
                <p>These retained quantities may predate a purchase or an earlier editor. Keep current inventory to save your other changes, or confirm the quantities you intend to change.</p>
                <Button disabled={saving || editIntent.current?.scope === scopeKey || !acknowledgedProduct.current} onClick={() => {
                    if (!acknowledgedProduct.current || editIntent.current?.scope === scopeKey) return
                    const baseline = savedSignature
                    applySnapshot(keepCurrentProductInventory(currentSnapshot, acknowledgedProduct.current))
                    setSavedSignature(baseline)
                }}>Keep current inventory</Button>
            </Banner>}

            {error && (
                <Banner variant="critical" title="Product needs attention">
                    {error}
                </Banner>
            )}

            {contextChanged && <Banner variant="critical" title="Account or store access changed">
                Reload this page before continuing. <Button onClick={() => window.location.reload()}>Reload page</Button>
            </Banner>}

            {isEditing && editBlocked && !productConflict && !contextChanged && (
                <Button onClick={() => void checkLatestProduct()}>Check latest product</Button>
            )}
            {productConflict && (
                <Banner variant="warning" title="This product changed">
                    <p>Latest: {String(productConflict.name)}, price {String(productConflict.price)}, stock {String(productConflict.stock)}. Your draft is kept.</p>
                    <Button onClick={reloadLatestProduct}>Reload latest and discard my edits</Button>
                </Banner>
            )}

            {success && (
                <Banner variant="success" title="Saved">
                    {success}
                </Banner>
            )}

            <div className="grid gap-[var(--lb-space-5)] lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                <div className="flex min-w-0 flex-col gap-[var(--lb-space-5)]">
                    <Card>
                        <Section title="Details" description="Name and describe the product as shoppers will see it.">
                            <Input
                                label="Title"
                                ref={titleInputRef}
                                required
                                error={!title.trim() && error === 'Add a product title before saving.' ? error : undefined}
                                placeholder="Short sleeve t-shirt"
                                value={title}
                                onChange={(event) => handleTitleChange(event.target.value)}
                            />
                            <Textarea
                                label="Description"
                                placeholder="Write a detailed description of your product."
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                            />
                        </Section>
                    </Card>

                    <Card>
                        <div className="space-y-[var(--lb-space-4)] p-[var(--lb-space-4)]"><ApparelFactsEditor value={apparelFacts} onChange={setApparelFacts} /><NicheFactsEditor key={scopeKey} value={currentSnapshot.nicheFacts} metadata={productMetadataRef.current} onChange={updateProductFacts} resources={{ images, variantOptions }} disabled={loadingProduct || editBlocked || contextChanged} giftMediaIssue={resolvedGiftDraft.issue} onConfirmGiftMedia={() => setGiftMediaImageOrder(JSON.stringify(images))} /></div>
                        <Section title="Media" description={images.length > PRODUCT_IMAGE_LIMIT ? `This product has ${images.length} retained images. Remove at least ${images.length - PRODUCT_IMAGE_LIMIT} before saving.` : `${images.length} of ${PRODUCT_IMAGE_LIMIT} images. The first image is the primary image.`}>
                            <MediaRecoveryNotice store={store} />
                            <Button variant="secondary" disabled={uploading || mediaUpload.blocked || images.length >= PRODUCT_IMAGE_LIMIT} onClick={() => setLibraryOpen(true)}>Browse image library</Button>
                            {libraryOpen && <MediaLibrary storeName={store} mediaType="image" onClose={() => setLibraryOpen(false)} onSelect={selectLibraryImage} />}
                            <Input unstyled
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                disabled={uploading || mediaUpload.blocked || images.length >= PRODUCT_IMAGE_LIMIT}
                                onChange={handleImageUpload}
                            />

                            {images.length > 0 ? (
                                <div className="grid grid-cols-2 gap-[var(--lb-space-3)] sm:grid-cols-3 md:grid-cols-4">
                                    {images.map((imageUrl, index) => (
                                        <div key={`${imageUrl}-${index}`} className="relative aspect-square overflow-hidden rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)]">
                                            {/* eslint-disable-next-line @next/next/no-img-element -- Product media URLs are merchant-uploaded and not allowlisted for next/image in this app. */}
                                            <img
                                                src={imageUrl}
                                                alt={`Product media ${index + 1}`}
                                                className="h-full w-full object-cover"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute right-[var(--lb-space-2)] top-[var(--lb-space-2)] h-[var(--lb-size-control-sm)] w-[var(--lb-size-control-sm)] rounded-[var(--lb-radius-full)]"
                                                onClick={() => removeImage(index)}
                                                aria-label={`Remove product media ${index + 1}`}
                                            >
                                                <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            </Button>
                                            <div className="absolute bottom-[var(--lb-space-2)] left-[var(--lb-space-2)] flex gap-[var(--lb-space-1)]">
                                                <Button type="button" variant="secondary" size="icon" aria-label={`Move product media ${index + 1} earlier`} disabled={index === 0} onClick={() => moveImage(index, index - 1)}><ArrowLeft aria-hidden="true" /></Button>
                                                <Button type="button" variant="secondary" size="icon" aria-label={`Move product media ${index + 1} later`} disabled={index === images.length - 1} onClick={() => moveImage(index, index + 1)}><ArrowRight aria-hidden="true" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState scene={isEditing ? 'product-detail' : 'product-editor'}
                                    icon={<ImageIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                    title="No product media yet"
                                    body="Upload product images so shoppers can inspect materials, colors, and details before buying."
                                    primaryAction={(
                                        <Button
                                            type="button"
                                            variant="primary"
                                            onClick={() => fileInputRef.current?.click()}
                                            loading={uploading}
                                            disabled={uploading || mediaUpload.blocked}
                                        >
                                            <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                            {uploading ? 'Uploading' : 'Upload media'}
                                        </Button>
                                    )}
                                />
                            )}

                            {images.length > 0 && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => fileInputRef.current?.click()}
                                    loading={uploading}
                                    disabled={uploading || mediaUpload.blocked || images.length >= PRODUCT_IMAGE_LIMIT}
                                >
                                    <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    {uploading ? 'Uploading' : 'Upload more media'}
                                </Button>
                            )}
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Category" description="Add category metadata for tax, discovery, and reporting.">
                            <Input
                                label="Category"
                                placeholder="Clothing, Electronics, Accessories"
                                helperText="Determines tax rates and adds product metadata."
                                value={category}
                                onChange={(event) => setCategory(event.target.value)}
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Pricing" description="Set the customer-facing price and internal product cost.">
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Input
                                    label="Price"
                                    type="number"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    value={price}
                                    onChange={(event) => setPrice(event.target.value)}
                                />
                                <Input
                                    label="Compare-at price"
                                    type="number"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                    value={comparePrice}
                                    onChange={(event) => setComparePrice(event.target.value)}
                                />
                            </div>
                            <CheckboxControl checked={chargeTax} onChange={setChargeTax}>
                                Charge tax on this product
                            </CheckboxControl>
                            <Input
                                label="Cost per item"
                                type="number"
                                placeholder="0.00"
                                helperText="Customers will not see this."
                                min="0"
                                step="0.01"
                                value={costPerItem}
                                onChange={(event) => setCostPerItem(event.target.value)}
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Inventory" description="Track SKU, barcode, and sell-through behavior.">
                            <CheckboxControl checked={trackInventory} onChange={setTrackInventory}>
                                Track quantity
                            </CheckboxControl>
                            {trackInventory && (
                                <>
                                    <Input
                                        label="Quantity"
                                        helperText="Available for sale. Existing reservations remain held. Saved variants retire only after all stock and open work are cleared; order, price and inventory history is kept."
                                        type="number"
                                        min="0"
                                        value={quantity}
                                        onChange={(event) => {
                                            setQuantity(event.target.value)
                                            if (quantityNeedsReview || quantityBaseline === undefined) {
                                                setQuantityBaseline(acknowledgedProduct.current?.quantity)
                                                setQuantityNeedsReview(false)
                                            }
                                        }}
                                    />
                                    <CheckboxControl checked={sellWhenOos} onChange={setSellWhenOos}>
                                        Continue selling when out of stock
                                    </CheckboxControl>
                                </>
                            )}
                            <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                <Input
                                    label="SKU (Stock Keeping Unit)"
                                    value={sku}
                                    onChange={(event) => setSku(event.target.value)}
                                />
                                <Input
                                    label="Barcode (ISBN, UPC, GTIN)"
                                    value={barcode}
                                    onChange={(event) => setBarcode(event.target.value)}
                                />
                            </div>
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Shipping" description="Collect fulfillment and customs information for physical products.">
                            <ShippingProfilePicker store={store} value={shippingProfileId} onChange={setShippingProfileId}/>
                            <CheckboxControl checked={isPhysical} onChange={setIsPhysical}>
                                This is a physical product
                            </CheckboxControl>
                            {isPhysical && (
                                <>
                                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                        <Input
                                            label="Weight"
                                            type="number"
                                            placeholder="0.0"
                                            min="0"
                                            step="0.1"
                                            value={weight}
                                            onChange={(event) => setWeight(event.target.value)}
                                        />
                                        <Select
                                            label="Unit"
                                            value={weightUnit}
                                            options={weightUnitOptions}
                                            onChange={(event) => setWeightUnit(event.target.value)}
                                        />
                                    </div>
                                    <Textarea
                                        label="Importer details (for imported products)"
                                        placeholder="Enter the importer name and contact/address details shown on the product package, when applicable."
                                        value={importerDetails}
                                        onChange={(event) => setImporterDetails(event.target.value.slice(0, 1000))}
                                        maxLength={1000}
                                    />
                                    <p className="m-0 text-sm text-[var(--lb-color-text-subdued)]">
                                        This information is shown publicly. Enter only details intended for a product listing; it is seller-provided and not independently verified.
                                    </p>
                                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                        <Input
                                            label="Country/Region of origin"
                                            placeholder="India"
                                            value={countryOfOrigin}
                                            onChange={(event) => setCountryOfOrigin(event.target.value.slice(0, 100))}
                                        />
                                        <Input
                                            label="HS (Harmonized System) code"
                                            value={hsCode}
                                            onChange={(event) => setHsCode(event.target.value)}
                                        />
                                    </div>
                                </>
                            )}
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Variants" description="Add options like size, color, or material.">
                            {variantOptions.length > 0 && (
                                <div className="flex flex-col gap-[var(--lb-space-3)]">
                                    {variantOptions.map((option, optionIndex) => (
                                        <div key={optionIndex} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                            <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                                <p className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                    {option.name}
                                                </p>
                                                <Button type="button" variant="ghost" size="sm" disabled={saving || loadingProduct || editBlocked || contextChanged}
                                                    aria-label={`Rename option ${option.name}`} onClick={() => setOptionRename({ scope: scopeKey, optionIndex, from: option.name, value: option.name })}>
                                                    <Edit3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Rename
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeOption(optionIndex)}
                                                >
                                                    <Trash2 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    Delete
                                                </Button>
                                            </div>

                                            {option.values.length > 0 && (
                                                <div className="mt-[var(--lb-space-3)] flex flex-wrap gap-[var(--lb-space-2)]">
                                                    {option.values.map((value, valueIndex) => (
                                                        <span
                                                            key={`${option.name}-${valueIndex}`}
                                                            className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]"
                                                        >
                                                            {value}
                                                            <Button type="button" variant="ghost" size="sm" disabled={saving || loadingProduct || editBlocked || contextChanged}
                                                                aria-label={`Rename ${option.name} value ${value}`} onClick={() => setOptionRename({ scope: scopeKey, optionIndex, valueIndex, from: value, value })}>
                                                                <Edit3 className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />Rename
                                                            </Button>
                                                            <Button unstyled
                                                                type="button"
                                                                className="text-[var(--lb-color-text-subdued)] hover:text-[var(--lb-color-critical)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                                onClick={() => removeValueFromOption(optionIndex, valueIndex)}
                                                                aria-label={`Remove ${value}`}
                                                            >
                                                                <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                            </Button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {editingOptionIndex === optionIndex ? (
                                                <div className="mt-[var(--lb-space-3)] flex flex-col gap-[var(--lb-space-2)] sm:flex-row">
                                                    <Input
                                                        placeholder="Add value"
                                                        value={newOptionValue}
                                                        onChange={(event) => setNewOptionValue(event.target.value)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === 'Enter') {
                                                                event.preventDefault()
                                                                addValueToOption(optionIndex)
                                                            }
                                                        }}
                                                        className="flex-1"
                                                    />
                                                    <Button type="button" variant="secondary" onClick={() => addValueToOption(optionIndex)}>
                                                        Add value
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="mt-[var(--lb-space-3)]"
                                                    onClick={() => setEditingOptionIndex(optionIndex)}
                                                >
                                                    <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                    Add values
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {showVariantBuilder ? (
                                <div className="flex flex-col gap-[var(--lb-space-2)] sm:flex-row">
                                    <Input
                                        placeholder="Option name (Size, Color, Material)"
                                        value={newOptionName}
                                        onChange={(event) => setNewOptionName(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                event.preventDefault()
                                                addVariantOption()
                                            }
                                        }}
                                        className="flex-1"
                                    />
                                    <Button type="button" onClick={addVariantOption}>
                                        Done
                                    </Button>
                                    <Button type="button" variant="secondary" onClick={() => setShowVariantBuilder(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <Button type="button" variant="secondary" onClick={() => setShowVariantBuilder(true)}>
                                    <Plus className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                    Add option
                                </Button>
                            )}
                        </Section>

                        {/* Variant matrix — auto-generated from option combos */}
                        {variantMatrix.length > 0 && (
                            <Section title="Variant combinations" description="Edit price, SKU, and quantity available for sale for each combination. Existing reservations remain held. Saved variants retire only after all stock and open work are cleared; order, price and inventory history is kept.">
                                <div className="overflow-x-auto">
                                    <Table className="w-full text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)]">
                                        <thead>
                                            <tr className="border-b border-[var(--lb-color-border)]">
                                                <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-subdued)]">Variant</th>
                                                <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-subdued)]">Price</th>
                                                <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-subdued)]">Compare</th>
                                                <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-subdued)]">SKU</th>
                                                <th className="pb-[var(--lb-space-2)] pr-[var(--lb-space-3)] text-left font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-subdued)]">Stock</th>
                                                <th className="pb-[var(--lb-space-2)] text-left font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text-subdued)]" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {variantMatrix.map((row, rowIndex) => (
                                                <tr key={row.id ?? `new-${rowIndex}`} className="border-b border-[var(--lb-color-border)] last:border-0">
                                                    <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-3)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">
                                                        {row.title}
                                                    </td>
                                                    <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-3)]">
                                                        <Input
                                                            unstyled
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder={price || '0.00'}
                                                            value={row.price}
                                                            aria-label={`Price for ${row.title}`}
                                                            onChange={(e) => setVariantMatrix((prev) => prev.map((r, i) => i === rowIndex ? { ...r, price: e.target.value } : r))}
                                                            className="w-[80px] rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)]"
                                                        />
                                                    </td>
                                                    <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-3)]">
                                                        <Input
                                                            unstyled
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="—"
                                                            value={row.comparePrice}
                                                            aria-label={`Compare-at price for ${row.title}`}
                                                            onChange={(e) => setVariantMatrix((prev) => prev.map((r, i) => i === rowIndex ? { ...r, comparePrice: e.target.value } : r))}
                                                            className="w-[80px] rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)]"
                                                        />
                                                    </td>
                                                    <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-3)]">
                                                        <Input
                                                            unstyled
                                                            placeholder="SKU-001"
                                                            value={row.sku}
                                                            aria-label={`SKU for ${row.title}`}
                                                            onChange={(e) => setVariantMatrix((prev) => prev.map((r, i) => i === rowIndex ? { ...r, sku: e.target.value } : r))}
                                                            className="w-[100px] rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)]"
                                                        />
                                                    </td>
                                                    <td className="py-[var(--lb-space-2)] pr-[var(--lb-space-3)]">
                                                        <Input
                                                            unstyled
                                                            type="number"
                                                            min="0"
                                                            placeholder="0"
                                                            value={row.stock}
                                                            aria-label={`Stock for ${row.title}`}
                                                            onChange={(e) => setVariantMatrix((prev) => prev.map((r, i) => i === rowIndex ? {
                                                                ...r, stock: e.target.value,
                                                                ...((r.stockNeedsReview || r.stockBaseline === undefined) && r.id ? {
                                                                    stockBaseline: acknowledgedProduct.current?.variantMatrix.find(saved => saved.id === r.id)?.stock,
                                                                    stockNeedsReview: !acknowledgedProduct.current?.variantMatrix.some(saved => saved.id === r.id),
                                                                } : {}),
                                                            } : r))}
                                                            className="w-[64px] rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)]"
                                                        />
                                                    </td>
                                                    <td className="py-[var(--lb-space-2)]">
                                                        <Button
                                                            unstyled
                                                            type="button"
                                                            aria-label={`${row.id ? 'Retire' : 'Remove'} variant ${row.title}`}
                                                            title={row.id ? 'Retire on save; stock and open work must be cleared. History is preserved.' : 'Remove this unsaved variant'}
                                                            onClick={() => setVariantMatrix((prev) => prev.filter((_, i) => i !== rowIndex))}
                                                            className="text-[var(--lb-color-text-subdued)] hover:text-[var(--lb-color-critical)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lb-color-focus-ring)]"
                                                        >
                                                            <X className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </div>
                                {variantMatrix.map((row, rowIndex) => (
                                    <details key={row.id ?? `new-${rowIndex}`} data-variant-facts={row.id ?? `new-${rowIndex}`}>
                                        <summary>Facts for {row.title}</summary>
                                        {!variantFactsBaselineKnown(row) && <Banner variant="warning" title="Review saved variant facts"><p>This restored row has no verified facts baseline. Check the latest product and explicitly reload it before editing these facts.</p><Button type="button" onClick={() => void checkLatestProduct()}>Review latest variant facts</Button></Banner>}
                                        <VariantFactsEditor value={variantFactsValue(row)} onChange={metadata => updateVariantFacts(row, metadata)} commonFacts={commonVariantFacts} resources={{ images, variantOptions }} disabled={saving || loadingProduct || editBlocked || contextChanged || !variantFactsBaselineKnown(row)} />
                                    </details>
                                ))}
                            </Section>
                        )}
                    </Card>

                    <Card>
                        <Section title="Search engine listing" description="Control how this product may appear in search results.">
                            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-success)]">
                                    {store}.{getStorefrontRootDomain()}/products/{urlHandle || '...'}
                                </p>
                                <p className="m-0 text-[var(--lb-font-size-heading)] font-[var(--lb-font-weight-medium)] leading-[var(--lb-line-height-heading)] text-[var(--lb-color-primary)] underline">
                                    {seoTitle || title || 'Page title'}
                                </p>
                                <p className="m-0 text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                    {seoDescription || description.substring(0, 160) || 'Meta description will show here.'}
                                </p>
                            </div>
                            <Input
                                label="Page title"
                                placeholder={title || 'Page title'}
                                maxLength={70}
                                helperText={`${seoTitle.length} of 70 characters used`}
                                value={seoTitle}
                                onChange={(event) => setSeoTitle(event.target.value)}
                            />
                            <Textarea
                                label="Meta description"
                                placeholder="Describe this product for search engines."
                                maxLength={160}
                                helperText={`${seoDescription.length} of 160 characters used`}
                                value={seoDescription}
                                onChange={(event) => setSeoDescription(event.target.value)}
                                className="min-h-[var(--lb-size-textarea-sm)]"
                            />
                            <Input
                                label="URL handle"
                                value={urlHandle}
                                onChange={(event) => setUrlHandle(event.target.value)}
                            />
                        </Section>
                    </Card>
                </div>

                <aside className="flex min-w-0 flex-col gap-[var(--lb-space-5)]">
                    <Card>
                        <Section title="Status">
                            <Select
                                label="Product status"
                                value={status}
                                options={isEditing ? [...statusOptions, ...editStatusOptions] : statusOptions}
                                onChange={(event) => setStatus(event.target.value as ProductFormSnapshot['status'])}
                            />
                            <Badge
                                label={isEditing && status === 'archived' ? 'Archived product' : status === 'active' ? 'Visible on storefront' : 'Draft product'}
                                variant={isEditing && status === 'archived' ? 'critical' : status === 'active' ? 'success' : 'warning'}
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Publishing">
                            <CheckboxControl checked disabled>
                                Online Store
                            </CheckboxControl>
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Product organization" description="Use consistent metadata to keep catalog management fast.">
                            <Input
                                label="Product type"
                                placeholder="T-shirt"
                                value={productType}
                                onChange={(event) => setProductType(event.target.value)}
                            />
                            <Input
                                label="Vendor"
                                placeholder="Nike"
                                value={vendor}
                                onChange={(event) => setVendor(event.target.value)}
                            />
                            <Input
                                label="Tags"
                                placeholder="Vintage, cotton, summer"
                                helperText="Separate tags with commas."
                                value={tags}
                                onChange={(event) => setTags(event.target.value)}
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Catalog readiness">
                            <div className="flex items-start gap-[var(--lb-space-3)] text-[var(--lb-font-size-body)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text-subdued)]">
                                <Package className="mt-[var(--lb-space-1)] h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)] text-[var(--lb-color-primary)]" aria-hidden="true" />
                                <p className="m-0">
                                    Save product details, media, pricing, and inventory from one guided form.
                                </p>
                            </div>
                        </Section>
                    </Card>

                    {isEditing && <MarketplaceReviewPanel
                        listing={marketplaceListingLoaded ? marketplaceListing : null}
                        loaded={marketplaceListingLoaded}
                        correction={marketplaceCorrection}
                        error={marketplaceCorrectionError}
                        submitting={resubmittingMarketplaceListing}
                        hasUnsavedChanges={hasUnsavedChanges}
                        onCorrectionChange={(value) => {
                            marketplaceResubmitKey.current = keepMarketplaceResubmissionKeyForReason(
                                marketplaceResubmitKey.current,
                                value,
                            )
                            setMarketplaceCorrection(value)
                            setMarketplaceCorrectionError(null)
                        }}
                        onResubmit={() => void resubmitMarketplaceListing()}
                    />}
                </aside>
            </div>

            {!saveBlocked && <SaveBar
                protectNavigation={false}
                discardDisabled={editIntent.current?.scope === scopeKey}
                state={saveState}
                onSave={() => void handleSave()}
                onDiscard={discardChanges}
                saveLabel={editIntent.current?.scope === scopeKey ? 'Retry pending save' : isEditing ? 'Save product' : 'Create product'}
            />}

            <Modal open={optionRename !== null && optionRename.scope === scopeKey} title={optionRename?.valueIndex === undefined ? 'Rename option name' : 'Rename option value'} description={optionRename?.valueIndex === undefined ? 'Variant identities, values, facts and inventory are kept. Review named option references in product facts before saving the product.' : 'Existing variant facts, prices and inventory are kept. Save the product to apply the change.'} onClose={() => setOptionRename(null)}
                footer={<><Button type="button" variant="secondary" onClick={() => setOptionRename(null)}>Cancel</Button><Button type="button" disabled={saving || loadingProduct || editBlocked || contextChanged} onClick={renameOptionValue}>{optionRename?.valueIndex === undefined ? 'Save name' : 'Save value'}</Button></>}>
                <Input label={optionRename?.valueIndex === undefined ? 'New name' : 'New value'} value={optionRename?.value ?? ''} maxLength={100} error={optionRename?.error}
                    onChange={event => setOptionRename(previous => previous ? { ...previous, value: event.target.value, error: undefined } : null)}
                    onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); renameOptionValue() } }} />
            </Modal>
            {saving && <span className="sr-only" aria-live="polite">Saving product</span>}
        </Page>
    )
}
