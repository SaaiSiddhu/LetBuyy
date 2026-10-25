import { ProductEditVariantSchema, ProductOptionSchema } from '@letbuyy/commerce-core'
import { captureProductFacts, readGiftImageOrder, resolveProductGiftImages } from './product-facts-draft'
import { hydrateVariantFacts, variantFactsCommand, variantRowsHaveBoundIdentityOrFacts } from './variant-facts-draft'

export interface VariantOption {
    name: string
    values: string[]
}

export interface VariantRow {
    id?: string           // present when editing existing rows
    option1: string | null
    option2: string | null
    option3: string | null
    title: string
    price: string
    comparePrice: string
    sku: string
    stock: string
    factsMetadataBaseline?: unknown
    factsMetadataDraft?: unknown
    factsMetadataEdited?: boolean
}

export interface ProductFormSnapshot {
    apparelFacts: string
    nicheFacts: string
    giftMediaImageOrder: string
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
    importerDetails: string
    hsCode: string
    variantOptions: VariantOption[]
    variantMatrix: VariantRow[]
    seoTitle: string
    seoDescription: string
    urlHandle: string
    status: 'active' | 'draft' | 'archived'
    productType: string
    vendor: string
    tags: string
}

export const defaultProductSnapshot: ProductFormSnapshot = {
    apparelFacts: '{}',
    nicheFacts: '',
    giftMediaImageOrder: '[]',
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
    importerDetails: '',
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
export function buildVariantMatrix(
    options: VariantOption[],
    basePrice: string,
    existingRows: VariantRow[] = [],
): VariantRow[] {
    const filled = options.filter((o) => o.values.length > 0)
    if (filled.length === 0 && existingRows.length === 0) return []

    // cartesian
    const combos: string[][] = filled.reduce<string[][]>((acc, opt) => {
        if (acc.length === 0) return opt.values.map((v) => [v])
        return acc.flatMap((row) => opt.values.map((v) => [...row, v]))
    }, [])

    const sameRows = combos.length === existingRows.length && combos.every((combo, index) => [existingRows[index].option1, existingRows[index].option2, existingRows[index].option3].every((value, axis) => value === (combo[axis] ?? null)))
    if (sameRows) return existingRows
    if (variantRowsHaveBoundIdentityOrFacts(existingRows)) throw new Error('Variant combinations are kept. Review and explicitly remove the affected variant rows before rebuilding; their identities and facts cannot be moved to new combinations.')
    return combos.map((combo) => {
        const o1 = combo[0] ?? null
        const o2 = combo[1] ?? null
        const o3 = combo[2] ?? null
        const title = combo.join(' / ')

        // Preserve edits from existing matching row
        const existing = existingRows.find(
            (r) => r.option1 === o1 && r.option2 === o2 && r.option3 === o3,
        )
        return hydrateVariantFacts({
            option1: o1,
            option2: o2,
            option3: o3,
            title,
            price: existing?.price ?? basePrice,
            comparePrice: existing?.comparePrice ?? '',
            sku: existing?.sku ?? '',
            stock: existing?.stock ?? '0',
        }, {})
    })
}

/** An explicit value addition keeps existing rows themselves; it never finds a
 * regenerated row and grafts an old identity/fact draft onto it. Other axis or
 * combination changes still go through the guarded full rebuild above. */
export function appendVariantOptionValue(options: VariantOption[], optionIndex: number, value: string, basePrice: string, rows: VariantRow[]): VariantRow[] {
    const option = options[optionIndex]
    if (!option || !value || option.values.includes(value)) throw new Error('Choose a new, distinct option value.')
    const nextOptions = options.map((item, index) => index === optionIndex ? { ...item, values: [...item.values, value] } : item)
    if (!rows.length || !option.values.length) return buildVariantMatrix(nextOptions, basePrice, rows)
    const axes = options.filter(item => item.values.length)
    const tuples = rows.map(row => [row.option1, row.option2, row.option3])
    if (axes.length > 3 || new Set(axes.map(axis => axis.name)).size !== axes.length
        || axes.some(axis => new Set(axis.values).size !== axis.values.length)
        || tuples.some(tuple => tuple.some((item, index) => index < axes.length ? item === null || !axes[index].values.includes(item) : item !== null))
        || new Set(tuples.map(tuple => JSON.stringify(tuple))).size !== rows.length) {
        throw new Error('Variant combinations are kept. Review existing rows before adding an option value.')
    }
    const added = buildVariantMatrix(options.map((item, index) => index === optionIndex ? { ...item, values: [value] } : item), basePrice)
    return [...rows, ...added]
}

/** Rename an existing axis value in place, never regenerate combinations or
 * transfer an identity/fact draft between rows. Sparse matrices stay sparse. */
export function renameVariantOptionValue(options: VariantOption[], optionIndex: number, valueIndex: number, value: string, rows: VariantRow[]): { options: VariantOption[]; rows: VariantRow[] } {
    const option = options[optionIndex], nextValue = value.trim()
    if (!Number.isInteger(optionIndex) || !Number.isInteger(valueIndex) || !option || valueIndex < 0 || valueIndex >= option.values.length) throw new Error('This option value has changed. Close and review the latest values.')
    if (!ProductOptionSchema.shape.values.unwrap().element.safeParse(nextValue).success) throw new Error('Enter an option value between 1 and 100 characters.')
    if (option.values.some((item, index) => index !== valueIndex && item.trim() === nextValue)) throw new Error('This option already has that value. Choose a distinct value.')
    const tuples = rows.map(row => [row.option1, row.option2, row.option3])
    const ids = rows.flatMap(row => row.id === undefined ? [] : [row.id])
    if (!options.length || options.length > 3 || new Set(options.map(axis => axis.name.trim())).size !== options.length
        || options.some(axis => !ProductOptionSchema.safeParse(axis).success || !axis.name.trim() || !axis.values.length || axis.values.some(item => !item.trim() || item !== item.trim()) || new Set(axis.values).size !== axis.values.length)
        || ids.some(id => !id) || new Set(ids).size !== ids.length
        || tuples.some(tuple => tuple.some((item, index) => index < options.length ? item === null || !options[index].values.includes(item) : item !== null))
        || new Set(tuples.map(tuple => JSON.stringify(tuple))).size !== rows.length
        || !tuples.some(tuple => tuple[optionIndex] === option.values[valueIndex])) {
        throw new Error('Variant combinations are kept. Review existing rows before renaming an option value.')
    }
    const previousValue = option.values[valueIndex]
    if (nextValue === previousValue) return { options, rows }
    const nextRows = rows.map((row, index) => {
        if (tuples[index][optionIndex] !== previousValue) return row
        const tuple = [...tuples[index]]; tuple[optionIndex] = nextValue
        return { ...row, option1: tuple[0], option2: tuple[1], option3: tuple[2], title: tuple.slice(0, options.length).join(' / ') }
    })
    if (nextRows.some(row => !ProductEditVariantSchema.shape.title.safeParse(row.title).success)) throw new Error('The combined variant label must be between 1 and 200 characters.')
    if (new Set(nextRows.map(row => JSON.stringify([row.option1, row.option2, row.option3]))).size !== rows.length) throw new Error('This rename would combine variant rows. Choose a distinct value.')
    return { options: options.map((axis, index) => index === optionIndex ? { ...axis, values: axis.values.map((item, index) => index === valueIndex ? nextValue : item) } : axis), rows: nextRows }
}

/** Map API variant rows back into VariantRow[] for edit hydration */
export function normalizeApiVariants(apiVariants: unknown[]): VariantRow[] {
    return apiVariants
        .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === 'object')
        .map((v) => hydrateVariantFacts({
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
        }, Object.hasOwn(v, 'metadata') ? v.metadata : {}))
}

export const weightUnitOptions = [
    { label: 'kg', value: 'kg' },
    { label: 'g', value: 'g' },
    { label: 'lb', value: 'lb' },
    { label: 'oz', value: 'oz' },
]

export const editStatusOptions = [{ label: 'Archived', value: 'archived' }]

export const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Draft', value: 'draft' },
]

export function createFormSignature(snapshot: ProductFormSnapshot) {
    return JSON.stringify(snapshot)
}

export interface ProductEditIntent {
    scope: string
    key: string
    version: number
    payload: string
    signature: string
    variantSignature: string
    hasNewVariants: boolean
}

export function isProductSnapshot(value: unknown): value is ProductFormSnapshot {
    if (!value || typeof value !== 'object') return false
    const draft = value as ProductFormSnapshot
    return Object.entries(defaultProductSnapshot).every(([key, initial]) => {
        const stored = draft[key as keyof ProductFormSnapshot]
        return Array.isArray(initial) ? Array.isArray(stored) : typeof stored === typeof initial
    }) && draft.images.every(image => typeof image === 'string')
        && draft.variantOptions.every(option => option && typeof option.name === 'string' && Array.isArray(option.values) && option.values.every(item => typeof item === 'string'))
        && draft.variantMatrix.every(row => row && ['title', 'price', 'comparePrice', 'sku', 'stock'].every(key => typeof row[key as keyof VariantRow] === 'string')
            && ['option1', 'option2', 'option3'].every(key => row[key as keyof VariantRow] === null || typeof row[key as keyof VariantRow] === 'string')
            && (row.id === undefined || typeof row.id === 'string')
            && (row.factsMetadataEdited === undefined || typeof row.factsMetadataEdited === 'boolean'))
        && ['active', 'draft', 'archived'].includes(draft.status)
}

export function publicMediaReference(value: string) {
    try {
        const url = new URL(value, 'https://draft.example')
        return ['https:', 'http:'].includes(url.protocol) && !url.search && !url.hash && !url.username && !url.password
    } catch { return false }
}

/** Filter public media without shifting the old identity array's indexed associations. */
export function retainProductMediaReferences(snapshot: ProductFormSnapshot): ProductFormSnapshot {
    const images = snapshot.images.filter(publicMediaReference)
    const previous = readGiftImageOrder(snapshot.giftMediaImageOrder)
    const safeOrder = previous ? JSON.stringify(previous.map(image => publicMediaReference(image) ? image : '')) : ''
    const resolved = resolveProductGiftImages(snapshot.nicheFacts, undefined, safeOrder, images)
    return { ...snapshot, images, nicheFacts: resolved.value, giftMediaImageOrder: resolved.imageOrder }
}

/** Unsaved public catalog fields, separate from the immutable pending command. */
export function readUnsavedProduct(raw: string, scope: string) {
    const record = JSON.parse(raw) as { scope?: unknown; version?: unknown; updatedAt?: unknown; snapshot?: unknown }
    // Older retained drafts predate optional garment facts. Upgrade only this
    // presentation snapshot; never rewrite an already-bound mutation payload.
    if (record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)
        && !('apparelFacts' in record.snapshot)) Object.assign(record.snapshot, { apparelFacts: '{}' })
    if (record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)
        && !('nicheFacts' in record.snapshot)) Object.assign(record.snapshot, { nicheFacts: '' })
    if (record.snapshot && typeof record.snapshot === 'object' && !Array.isArray(record.snapshot)
        && !('giftMediaImageOrder' in record.snapshot)) Object.assign(record.snapshot, { giftMediaImageOrder: '' })
    if (record.scope !== scope || typeof record.updatedAt !== 'number' || record.updatedAt > Date.now()
        || Date.now() - record.updatedAt > 12 * 60 * 60 * 1000 || !isProductSnapshot(record.snapshot)
        || !(record.version === null || (typeof record.version === 'number' && Number.isInteger(record.version) && record.version > 0))) {
        throw new Error('The retained draft is expired or unreadable. Discard it before continuing.')
    }
    return { snapshot: record.snapshot, version: record.version as number | null }
}

// This is a per-tab recovery record, never authority. SQL still verifies the
// current actor/store, exact version and complete request binding on every retry.
export function restoreProductEdit(raw: string, scope: string): { intent: ProductEditIntent; draft: ProductFormSnapshot } {
    const saved = JSON.parse(raw) as ProductEditIntent & { draftSignature?: string }
    if (saved.scope !== scope || typeof saved.key !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(saved.key)
        || !Number.isInteger(saved.version) || saved.version <= 0 || typeof saved.payload !== 'string'
        || typeof saved.signature !== 'string' || typeof saved.variantSignature !== 'string' || typeof saved.hasNewVariants !== 'boolean') {
        throw new Error('The pending product request is unreadable. Keep this page open and review the saved request before continuing.')
    }
    const body = JSON.parse(saved.payload) as Record<string, unknown>
    const draft = JSON.parse(saved.draftSignature ?? saved.signature) as ProductFormSnapshot
    if (draft && typeof draft === 'object' && !('apparelFacts' in draft)) Object.assign(draft, { apparelFacts: '{}' })
    if (draft && typeof draft === 'object' && !('nicheFacts' in draft)) Object.assign(draft, { nicheFacts: '' })
    if (draft && typeof draft === 'object' && !('giftMediaImageOrder' in draft)) Object.assign(draft, { giftMediaImageOrder: '' })
    if (!isProductSnapshot(draft) || !body || body.version !== saved.version || body.idempotency_key !== saved.key) {
        throw new Error('The pending product request is unreadable. Keep this page open and review the saved request before continuing.')
    }
    const intent = { ...saved }
    delete intent.draftSignature
    return { intent, draft }
}

export function generateHandle(text: string) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

export function getPayloadError(payload: unknown, fallback: string) {
    if (!payload || typeof payload !== 'object') return fallback
    const errorValue = (payload as { error?: unknown }).error
    if (typeof errorValue === 'string') return errorValue
    if (errorValue && typeof errorValue === 'object' && typeof (errorValue as { message?: unknown }).message === 'string') {
        return (errorValue as { message: string }).message
    }
    const message = (payload as { message?: unknown }).message
    return typeof message === 'string' ? message : fallback
}

export function normalizeString(value: unknown) {
    return typeof value === 'string' ? value : ''
}

export function normalizeNumberInput(value: unknown) {
    if (value === null || value === undefined || value === '') return ''
    const numberValue = Number(value)
    return Number.isFinite(numberValue) ? String(numberValue) : ''
}

export function normalizeProductSnapshot(product: Record<string, unknown>): ProductFormSnapshot {
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
        apparelFacts: JSON.stringify(product.metadata && typeof product.metadata === 'object' && !Array.isArray(product.metadata) ? (product.metadata as Record<string, unknown>).apparel ?? {} : {}),
        nicheFacts: JSON.stringify(captureProductFacts(product.metadata)),
        giftMediaImageOrder: JSON.stringify(Array.isArray(product.images) ? product.images.filter((image): image is string => typeof image === 'string') : []),
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
        importerDetails: normalizeString(product.importer_details),
        hsCode: normalizeString(product.hs_code),
        variantOptions: productOptions,
        variantMatrix,
        seoTitle: normalizeString(product.seo_title),
        seoDescription: normalizeString(product.seo_description),
        urlHandle: normalizeString(product.url_handle || product.slug),
        status: product.status === 'archived' ? 'archived' : product.is_active === false || product.status === 'draft' ? 'draft' : 'active',
        productType: normalizeString(product.product_type),
        vendor: normalizeString(product.vendor),
        tags: Array.isArray(product.tags) ? product.tags.filter((tag): tag is string => typeof tag === 'string').join(', ') : '',
    }
}

/** Existing product form serialization; server command validation remains authoritative. */
export function buildProductFormFields(snapshot: ProductFormSnapshot, metadata: Record<string, unknown> | undefined, isEditing: boolean) {
    const {
        title, description, images, category, price, comparePrice, costPerItem, chargeTax,
        quantity, trackInventory, sku, barcode, sellWhenOos, isPhysical, weight, weightUnit,
        countryOfOrigin, importerDetails, hsCode, urlHandle, seoTitle, seoDescription,
        productType, vendor, tags, status, variantOptions, variantMatrix,
    } = snapshot
    const productTitle = title.trim()
    return {
        metadata,
        name: productTitle,
        description: description.trim(),
        images,
        category: category || (isEditing ? null : undefined),
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
        country_of_origin: countryOfOrigin.trim() || null,
        importer_details: importerDetails.trim() || null,
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
            ...(isEditing && row.id ? { id: row.id } : {}),
            ...variantFactsCommand(row),
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
    }
}
