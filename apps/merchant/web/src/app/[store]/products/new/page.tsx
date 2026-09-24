'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button, Input,
    ArrowLeft,
    Badge,
    Banner,
    Card,
    EmptyState,
    Image as ImageIcon,
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
} from '@letbuyy/ui'

interface VariantOption {
    name: string
    values: string[]
}

interface VariantRow {
    id?: string           // present when editing existing rows
    option1: string | null
    option2: string | null
    option3: string | null
    title: string
    price: string
    comparePrice: string
    sku: string
    stock: string
}

interface ProductFormSnapshot {
    title: string
    description: string
    images: string[]
    category: string
    price: string
    comparePrice: string
    costPerItem: string
    chargeTax: boolean
    trackInventory: boolean
    quantity: string
    sku: string
    barcode: string
    sellWhenOos: boolean
    isPhysical: boolean
    weight: string
    weightUnit: string
    countryOfOrigin: string
    hsCode: string
    variantOptions: VariantOption[]
    variantMatrix: VariantRow[]
    seoTitle: string
    seoDescription: string
    urlHandle: string
    status: 'active' | 'draft'
    productType: string
    vendor: string
    tags: string
}

const defaultProductSnapshot: ProductFormSnapshot = {
    title: '',
    description: '',
    images: [],
    category: '',
    price: '',
    comparePrice: '',
    costPerItem: '',
    chargeTax: true,
    trackInventory: true,
    quantity: '10',
    sku: '',
    barcode: '',
    sellWhenOos: false,
    isPhysical: true,
    weight: '',
    weightUnit: 'kg',
    countryOfOrigin: '',
    hsCode: '',
    variantOptions: [],
    variantMatrix: [],
    seoTitle: '',
    seoDescription: '',
    urlHandle: '',
    status: 'active',
    productType: '',
    vendor: '',
    tags: '',
}

/** Generate cartesian product of option values then build VariantRow[] */
function buildVariantMatrix(
    options: VariantOption[],
    basePrice: string,
    existingRows: VariantRow[] = [],
): VariantRow[] {
    const filled = options.filter((o) => o.values.length > 0)
    if (filled.length === 0) return []

    // cartesian
    const combos: string[][] = filled.reduce<string[][]>((acc, opt) => {
        if (acc.length === 0) return opt.values.map((v) => [v])
        return acc.flatMap((row) => opt.values.map((v) => [...row, v]))
    }, [])

    return combos.map((combo) => {
        const o1 = combo[0] ?? null
        const o2 = combo[1] ?? null
        const o3 = combo[2] ?? null
        const title = combo.join(' / ')

        // Preserve edits from existing matching row
        const existing = existingRows.find(
            (r) => r.option1 === o1 && r.option2 === o2 && r.option3 === o3,
        )
        return {
            id: existing?.id,
            option1: o1,
            option2: o2,
            option3: o3,
            title,
            price: existing?.price ?? basePrice,
            comparePrice: existing?.comparePrice ?? '',
            sku: existing?.sku ?? '',
            stock: existing?.stock ?? '0',
        }
    })
}

/** Map API variant rows back into VariantRow[] for edit hydration */
function normalizeApiVariants(apiVariants: unknown[]): VariantRow[] {
    return apiVariants
        .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
        .map((v) => ({
            id: typeof v.id === 'string' ? v.id : undefined,
            option1: typeof v.option1 === 'string' ? v.option1 : null,
            option2: typeof v.option2 === 'string' ? v.option2 : null,
            option3: typeof v.option3 === 'string' ? v.option3 : null,
            title: typeof v.title === 'string' ? v.title : '',
            price: v.price !== undefined && v.price !== null ? String(v.price) : '',
            comparePrice: v.compare_price !== undefined && v.compare_price !== null ? String(v.compare_price) : '',
            sku: typeof v.sku === 'string' ? v.sku : '',
            stock: v.inventory_qty !== undefined && v.inventory_qty !== null
                ? String(v.inventory_qty)
                : v.stock !== undefined && v.stock !== null ? String(v.stock) : '0',
        }))
}

const weightUnitOptions = [
    { label: 'kg', value: 'kg' },
    { label: 'g', value: 'g' },
    { label: 'lb', value: 'lb' },
    { label: 'oz', value: 'oz' },
]

const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
]

function createFormSignature(snapshot: ProductFormSnapshot) {
    return JSON.stringify(snapshot)
}

function generateHandle(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

function getPayloadError(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== 'object') return fallback
    const errorValue = (payload as { error?: unknown }).error
    if (typeof errorValue === 'string') return errorValue
    if (errorValue && typeof errorValue === 'object' && typeof (errorValue as { message?: unknown }).message === 'string') {
        return (errorValue as { message: string }).message
    }
    const message = (payload as { message?: unknown }).message
    return typeof message === 'string' ? message : fallback
}

function normalizeString(value: unknown) {
    return typeof value === 'string' ? value : ''
}

function normalizeNumberInput(value: unknown) {
    if (value === null || value === undefined || value === '') return ''
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? String(numberValue) : ''
}

function normalizeProductSnapshot(product: Record<string, unknown>): ProductFormSnapshot {
    const productOptions = Array.isArray(product.product_options)
        ? product.product_options
            .filter((option): option is VariantOption => {
                if (!option || typeof option !== 'object') return false
                const value = option as VariantOption
                return typeof value.name === 'string' && Array.isArray(value.values)
            })
            .map((option) => ({
                name: option.name,
                values: option.values.filter((value): value is string => typeof value === 'string'),
            }))
        : []

    const apiVariants = Array.isArray(product.variants) ? product.variants as unknown[] : []
    const variantMatrix = apiVariants.length > 0 ? normalizeApiVariants(apiVariants) : []

    return {
        title: normalizeString(product.name),
        description: normalizeString(product.description),
        images: Array.isArray(product.images) ? product.images.filter((image): image is string => typeof image === 'string') : [],
        category: normalizeString(product.category),
        price: normalizeNumberInput(product.price),
        comparePrice: normalizeNumberInput(product.compare_price ?? product.compare_at_price),
        costPerItem: normalizeNumberInput(product.cost_per_item ?? product.cost_price),
        chargeTax: product.charge_tax !== false,
        trackInventory: product.track_inventory !== false,
        quantity: normalizeNumberInput(product.stock ?? product.stock_quantity ?? 0),
        sku: normalizeString(product.sku),
        barcode: normalizeString(product.barcode),
        sellWhenOos: Boolean(product.sell_when_oos),
        isPhysical: product.is_physical !== false,
        weight: normalizeNumberInput(product.weight),
        weightUnit: normalizeString(product.weight_unit) || 'kg',
        countryOfOrigin: normalizeString(product.country_of_origin),
        hsCode: normalizeString(product.hs_code),
        variantOptions: productOptions,
        variantMatrix,
        seoTitle: normalizeString(product.seo_title),
        seoDescription: normalizeString(product.seo_description),
        urlHandle: normalizeString(product.url_handle || product.slug),
        status: product.is_active === false || product.status === 'draft' ? 'draft' : 'active',
        productType: normalizeString(product.product_type),
        vendor: normalizeString(product.vendor),
        tags: Array.isArray(product.tags) ? product.tags.filter((tag): tag is string => typeof tag === 'string').join(', ') : '',
    }
}

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
    const router = useRouter()
    const { notify } = useToast()
    const fileInputRef = useRef<HTMLInputElement>(null)
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
    const [sku, setSku] = useState(defaultProductSnapshot.sku)
    const [barcode, setBarcode] = useState(defaultProductSnapshot.barcode)
    const [sellWhenOos, setSellWhenOos] = useState(defaultProductSnapshot.sellWhenOos)
    const [isPhysical, setIsPhysical] = useState(defaultProductSnapshot.isPhysical)
    const [weight, setWeight] = useState(defaultProductSnapshot.weight)
    const [weightUnit, setWeightUnit] = useState(defaultProductSnapshot.weightUnit)
    const [countryOfOrigin, setCountryOfOrigin] = useState(defaultProductSnapshot.countryOfOrigin)
    const [hsCode, setHsCode] = useState(defaultProductSnapshot.hsCode)
    const [variantOptions, setVariantOptions] = useState<VariantOption[]>(defaultProductSnapshot.variantOptions)
    const [variantMatrix, setVariantMatrix] = useState<VariantRow[]>(defaultProductSnapshot.variantMatrix)
    const [showVariantBuilder, setShowVariantBuilder] = useState(false)
    const [newOptionName, setNewOptionName] = useState('')
    const [newOptionValue, setNewOptionValue] = useState('')
    const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null)
    const [seoTitle, setSeoTitle] = useState(defaultProductSnapshot.seoTitle)
    const [seoDescription, setSeoDescription] = useState(defaultProductSnapshot.seoDescription)
    const [urlHandle, setUrlHandle] = useState(defaultProductSnapshot.urlHandle)
    const [status, setStatus] = useState<'active' | 'draft'>(defaultProductSnapshot.status)
    const [productType, setProductType] = useState(defaultProductSnapshot.productType)
    const [vendor, setVendor] = useState(defaultProductSnapshot.vendor)
    const [tags, setTags] = useState(defaultProductSnapshot.tags)
    const [saving, setSaving] = useState(false)
    const [loadingProduct, setLoadingProduct] = useState(isEditing)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [savedSignature, setSavedSignature] = useState<string | null>(() => (
        isEditing ? null : createFormSignature(defaultProductSnapshot)
    ))

    const currentSnapshot = useMemo<ProductFormSnapshot>(() => ({
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
        sku,
        barcode,
        sellWhenOos,
        isPhysical,
        weight,
        weightUnit,
        countryOfOrigin,
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
        barcode,
        category,
        chargeTax,
        comparePrice,
        costPerItem,
        countryOfOrigin,
        description,
        hsCode,
        images,
        isPhysical,
        price,
        productType,
        quantity,
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
    ])

    const currentSignature = useMemo(() => createFormSignature(currentSnapshot), [currentSnapshot])
    const hasUnsavedChanges = Boolean(savedSignature && currentSignature !== savedSignature)
    const saveState = saving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'

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
        setSku(snapshot.sku)
        setBarcode(snapshot.barcode)
        setSellWhenOos(snapshot.sellWhenOos)
        setIsPhysical(snapshot.isPhysical)
        setWeight(snapshot.weight)
        setWeightUnit(snapshot.weightUnit)
        setCountryOfOrigin(snapshot.countryOfOrigin)
        setHsCode(snapshot.hsCode)
        setVariantOptions(snapshot.variantOptions)
        setVariantMatrix(snapshot.variantMatrix)
        setSeoTitle(snapshot.seoTitle)
        setSeoDescription(snapshot.seoDescription)
        setUrlHandle(snapshot.urlHandle)
        setStatus(snapshot.status)
        setProductType(snapshot.productType)
        setVendor(snapshot.vendor)
        setTags(snapshot.tags)
        setSavedSignature(createFormSignature(snapshot))
    }, [])

    const loadProduct = useCallback(async () => {
        if (!isEditing || !productId) return

        setLoadingProduct(true)
        setError(null)

        try {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/products/${encodeURIComponent(productId)}`)
            const payload = await response.json().catch(() => null)

            if (!response.ok || !payload?.data) {
                throw new Error(getPayloadError(payload, 'Unable to load product'))
            }

            applySnapshot(normalizeProductSnapshot(payload.data as Record<string, unknown>))
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unable to load product'
            setError(message)
            notify({
                title: 'Product could not load',
                description: message,
                variant: 'critical',
            })
        } finally {
            setLoadingProduct(false)
        }
    }, [applySnapshot, isEditing, notify, productId, store])

    useEffect(() => {
        void loadProduct()
    }, [loadProduct])

    const handleTitleChange = (value: string) => {
        setTitle(value)
        if (!urlHandle || urlHandle === generateHandle(title)) {
            setUrlHandle(generateHandle(value))
        }
    }

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        const newImages: string[] = []
        const failures: string[] = []

        for (const file of Array.from(files)) {
            const formData = new FormData()
            formData.append('file', file)

            try {
                const response = await fetch(`/api/stores/${encodeURIComponent(store)}/upload`, {
                    method: 'POST',
                    body: formData,
                })
                const payload = await response.json().catch(() => null)

                if (response.ok && payload?.data?.url) {
                    newImages.push(payload.data.url)
                } else {
                    failures.push(file.name)
                }
            } catch {
                failures.push(file.name)
            }
        }

        if (newImages.length > 0) {
            setImages((prev) => [...prev, ...newImages])
            notify({
                title: newImages.length === 1 ? 'Image uploaded' : 'Images uploaded',
                description: 'Save the product to keep these media changes.',
                variant: 'success',
            })
        }

        if (failures.length > 0) {
            notify({
                title: 'Some images could not upload',
                description: failures.slice(0, 3).join(', '),
                variant: 'warning',
            })
        }

        setUploading(false)
        event.target.value = ''
    }

    const removeImage = (index: number) => {
        setImages((prev) => prev.filter((_, imageIndex) => imageIndex !== index))
    }

    const rebuildMatrix = useCallback((nextOptions: VariantOption[], currentMatrix: VariantRow[], basePrice: string) => {
        setVariantMatrix(buildVariantMatrix(nextOptions, basePrice, currentMatrix))
    }, [])

    const addVariantOption = () => {
        const optionName = newOptionName.trim()
        if (!optionName) return
        const nextOptions = [...variantOptions, { name: optionName, values: [] }]
        setVariantOptions(nextOptions)
        setEditingOptionIndex(variantOptions.length)
        setNewOptionName('')
        setShowVariantBuilder(false)
        rebuildMatrix(nextOptions, variantMatrix, price)
    }

    const addValueToOption = (optionIndex: number) => {
        const optionValue = newOptionValue.trim()
        if (!optionValue) return
        setVariantOptions((prev) => {
            const nextOptions = prev.map((option, index) => (
                index === optionIndex
                    ? { ...option, values: [...option.values, optionValue] }
                    : option
            ))
            rebuildMatrix(nextOptions, variantMatrix, price)
            return nextOptions
        })
        setNewOptionValue('')
    }

    const removeValueFromOption = (optionIndex: number, valueIndex: number) => {
        setVariantOptions((prev) => {
            const nextOptions = prev.map((option, index) => (
                index === optionIndex
                    ? { ...option, values: option.values.filter((_, valueIndexCurrent) => valueIndexCurrent !== valueIndex) }
                    : option
            ))
            rebuildMatrix(nextOptions, variantMatrix, price)
            return nextOptions
        })
    }

    const removeOption = (index: number) => {
        setVariantOptions((prev) => {
            const nextOptions = prev.filter((_, optionIndex) => optionIndex !== index)
            rebuildMatrix(nextOptions, variantMatrix, price)
            return nextOptions
        })
        if (editingOptionIndex === index) setEditingOptionIndex(null)
    }

    const handleSave = useCallback(async () => {
        const productTitle = title.trim()
        if (!productTitle) {
            const message = 'Add a product title before saving.'
            setError(message)
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

            const response = await fetch(endpoint, {
                method: isEditing ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: productTitle,
                    description: description.trim(),
                    images,
                    category: category || null,
                    price: parseFloat(price) || 0,
                    compare_price: parseFloat(comparePrice) || null,
                    cost_per_item: parseFloat(costPerItem) || null,
                    charge_tax: chargeTax,
                    stock: parseInt(quantity) || 0,
                    track_inventory: trackInventory,
                    sku: sku || null,
                    barcode: barcode || null,
                    sell_when_oos: sellWhenOos,
                    is_physical: isPhysical,
                    weight: parseFloat(weight) || null,
                    weight_unit: weightUnit,
                    country_of_origin: countryOfOrigin || null,
                    hs_code: hsCode || null,
                    url_handle: urlHandle || null,
                    seo_title: seoTitle || null,
                    seo_description: seoDescription || null,
                    product_type: productType || null,
                    vendor: vendor || null,
                    tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : [],
                    is_active: status === 'active',
                    product_options: variantOptions.map((option, index) => ({
                        name: option.name,
                        position: index,
                        values: option.values,
                    })),
                    variants: variantMatrix.map((row, index) => ({
                        title: row.title,
                        price: parseFloat(row.price) || parseFloat(price) || 0,
                        compare_price: parseFloat(row.comparePrice) || null,
                        sku: row.sku || null,
                        stock: parseInt(row.stock) || 0,
                        options: [
                            row.option1 ? variantOptions[0]?.name ?? 'Option 1' : null,
                            row.option2 ? variantOptions[1]?.name ?? 'Option 2' : null,
                            row.option3 ? variantOptions[2]?.name ?? 'Option 3' : null,
                        ]
                            .map((name, i) => {
                                const vals = [row.option1, row.option2, row.option3]
                                return name && vals[i] ? [name, vals[i]] : null
                            })
                            .filter((entry): entry is [string, string] => entry !== null)
                            .reduce<Record<string, string>>((acc, [k, v]) => { acc[k] = v; return acc }, {}),
                        position: index,
                    })),
                }),
            })

            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                throw new Error(getPayloadError(payload, 'Failed to save product'))
            }

            if (isEditing) {
                if (payload?.data) {
                    applySnapshot(normalizeProductSnapshot(payload.data as Record<string, unknown>))
                } else {
                    setSavedSignature(currentSignature)
                }
                setSuccess('Product saved')
                notify({
                    title: 'Product saved',
                    description: `${productTitle} is up to date.`,
                    variant: 'success',
                })
            } else {
                setSavedSignature(currentSignature)
                notify({
                    title: 'Product created',
                    description: `${productTitle} was added to your catalog.`,
                    variant: 'success',
                })
                router.push(`/${store}/products`)
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save product'
            setError(message)
            notify({
                title: 'Could not save product',
                description: message,
                variant: 'critical',
            })
        } finally {
            setSaving(false)
        }
    }, [
        applySnapshot,
        barcode,
        category,
        chargeTax,
        comparePrice,
        costPerItem,
        countryOfOrigin,
        currentSignature,
        description,
        hsCode,
        images,
        isEditing,
        isPhysical,
        notify,
        price,
        productId,
        productType,
        quantity,
        router,
        sellWhenOos,
        seoDescription,
        seoTitle,
        sku,
        status,
        store,
        tags,
        title,
        trackInventory,
        urlHandle,
        variantMatrix,
        variantOptions,
        vendor,
        weight,
        weightUnit,
    ])

    const discardChanges = useCallback(() => {
        router.push(`/${store}/products`)
    }, [router, store])

    if (loadingProduct) {
        return (
            <Page>
                <PageHeader
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
            <PageHeader
                title={isEditing ? 'Edit product' : 'Add product'}
                description={isEditing ? 'Update product details, media, pricing, inventory, and search metadata.' : 'Create a catalog-ready product with the details shoppers need.'}
                breadcrumbs={[{ label: 'Products', href: `/${store}/products` }, { label: isEditing ? 'Edit product' : 'Add product' }]}
                primaryAction={{
                    label: saving ? 'Saving' : 'Save product',
                    onClick: () => void handleSave(),
                    icon: <Save className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    disabled: saving,
                }}
                secondaryActions={[{
                    label: 'Discard',
                    href: `/${store}/products`,
                    icon: <ArrowLeft className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />,
                    disabled: saving,
                }]}
            />

            {error && (
                <Banner variant="critical" title="Product needs attention">
                    {error}
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
                        <Section title="Media" description="Upload images that help shoppers inspect the product.">
                            <Input unstyled
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
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
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <EmptyState
                                    icon={<ImageIcon className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />}
                                    title="No product media yet"
                                    body="Upload product images so shoppers can inspect materials, colors, and details before buying."
                                    primaryAction={(
                                        <Button
                                            type="button"
                                            variant="primary"
                                            onClick={() => fileInputRef.current?.click()}
                                            loading={uploading}
                                            disabled={uploading}
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
                                    disabled={uploading}
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
                                        type="number"
                                        min="0"
                                        value={quantity}
                                        onChange={(event) => setQuantity(event.target.value)}
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
                                    <div className="grid gap-[var(--lb-space-4)] md:grid-cols-2">
                                        <Input
                                            label="Country/Region of origin"
                                            placeholder="India"
                                            value={countryOfOrigin}
                                            onChange={(event) => setCountryOfOrigin(event.target.value)}
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
                                        <div key={`${option.name}-${optionIndex}`} className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                            <div className="flex items-center justify-between gap-[var(--lb-space-3)]">
                                                <p className="m-0 text-[var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[var(--lb-color-text)]">
                                                    {option.name}
                                                </p>
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
                                                            key={`${value}-${valueIndex}`}
                                                            className="inline-flex items-center gap-[var(--lb-space-1)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-text)]"
                                                        >
                                                            {value}
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
                            <Section title="Variant combinations" description="Edit price, SKU, and stock for each combination.">
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
                                                <tr key={`${row.option1}-${row.option2}-${row.option3}-${rowIndex}`} className="border-b border-[var(--lb-color-border)] last:border-0">
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
                                                            onChange={(e) => setVariantMatrix((prev) => prev.map((r, i) => i === rowIndex ? { ...r, stock: e.target.value } : r))}
                                                            className="w-[64px] rounded-md border border-[var(--lb-color-border)] bg-[var(--lb-color-surface)] px-[var(--lb-space-2)] py-[var(--lb-space-1)] text-[var(--lb-font-size-caption)]"
                                                        />
                                                    </td>
                                                    <td className="py-[var(--lb-space-2)]">
                                                        <Button
                                                            unstyled
                                                            type="button"
                                                            aria-label={`Remove variant ${row.title}`}
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
                            </Section>
                        )}
                    </Card>

                    <Card>
                        <Section title="Search engine listing" description="Control how this product may appear in search results.">
                            <div className="rounded-[var(--lb-radius-lg)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-4)]">
                                <p className="m-0 text-[var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[var(--lb-color-success)]">
                                    {store}.letbuyy.com/products/{urlHandle || '...'}
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
                                options={statusOptions}
                                onChange={(event) => setStatus(event.target.value as 'active' | 'draft')}
                            />
                            <Badge
                                label={status === 'active' ? 'Visible on storefront' : 'Draft product'}
                                variant={status === 'active' ? 'success' : 'warning'}
                            />
                        </Section>
                    </Card>

                    <Card>
                        <Section title="Publishing">
                            <CheckboxControl checked readOnly>
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
                </aside>
            </div>

            <SaveBar
                state={saveState}
                onSave={() => void handleSave()}
                onDiscard={discardChanges}
                saveLabel={isEditing ? 'Save product' : 'Create product'}
            />

            {saving && <span className="sr-only" aria-live="polite">Saving product</span>}
        </Page>
    )
}
