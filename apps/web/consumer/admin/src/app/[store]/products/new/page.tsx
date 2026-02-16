'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface VariantOption {
    name: string
    values: string[]
}

export default function AddProductPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ——— Form state ———
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [images, setImages] = useState<string[]>([])
    const [uploading, setUploading] = useState(false)

    // Category
    const [category, setCategory] = useState('')

    // Pricing
    const [price, setPrice] = useState('')
    const [comparePrice, setComparePrice] = useState('')
    const [costPerItem, setCostPerItem] = useState('')
    const [chargeTax, setChargeTax] = useState(true)

    // Inventory
    const [trackInventory, setTrackInventory] = useState(true)
    const [quantity, setQuantity] = useState('0')
    const [sku, setSku] = useState('')
    const [barcode, setBarcode] = useState('')
    const [sellWhenOos, setSellWhenOos] = useState(false)

    // Shipping
    const [isPhysical, setIsPhysical] = useState(true)
    const [weight, setWeight] = useState('')
    const [weightUnit, setWeightUnit] = useState('kg')
    const [countryOfOrigin, setCountryOfOrigin] = useState('')
    const [hsCode, setHsCode] = useState('')

    // Variants
    const [variantOptions, setVariantOptions] = useState<VariantOption[]>([])
    const [showVariantBuilder, setShowVariantBuilder] = useState(false)
    const [newOptionName, setNewOptionName] = useState('')
    const [newOptionValue, setNewOptionValue] = useState('')
    const [editingOptionIndex, setEditingOptionIndex] = useState<number | null>(null)

    // SEO
    const [seoTitle, setSeoTitle] = useState('')
    const [seoDescription, setSeoDescription] = useState('')
    const [urlHandle, setUrlHandle] = useState('')

    // Sidebar
    const [status, setStatus] = useState<'active' | 'draft'>('active')
    const [productType, setProductType] = useState('')
    const [vendor, setVendor] = useState('')
    const [tags, setTags] = useState('')

    // Save state
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // ——— Auto-generate URL handle from title ———
    const generateHandle = (text: string) => {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
    }

    const handleTitleChange = (value: string) => {
        setTitle(value)
        if (!urlHandle || urlHandle === generateHandle(title)) {
            setUrlHandle(generateHandle(value))
        }
    }

    // ——— Image upload ———
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        const newImages: string[] = []

        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()
            const fileName = `${store}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`

            const { error: uploadError } = await supabase.storage
                .from('product-images')
                .upload(fileName, file)

            if (!uploadError) {
                const { data: urlData } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName)
                newImages.push(urlData.publicUrl)
            }
        }

        setImages(prev => [...prev, ...newImages])
        setUploading(false)
    }

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index))
    }

    // ——— Variant management ———
    const addVariantOption = () => {
        if (!newOptionName.trim()) return
        setVariantOptions(prev => [...prev, { name: newOptionName.trim(), values: [] }])
        setEditingOptionIndex(variantOptions.length)
        setNewOptionName('')
    }

    const addValueToOption = (optionIndex: number) => {
        if (!newOptionValue.trim()) return
        setVariantOptions(prev => prev.map((opt, i) =>
            i === optionIndex
                ? { ...opt, values: [...opt.values, newOptionValue.trim()] }
                : opt
        ))
        setNewOptionValue('')
    }

    const removeValueFromOption = (optionIndex: number, valueIndex: number) => {
        setVariantOptions(prev => prev.map((opt, i) =>
            i === optionIndex
                ? { ...opt, values: opt.values.filter((_, vi) => vi !== valueIndex) }
                : opt
        ))
    }

    const removeOption = (index: number) => {
        setVariantOptions(prev => prev.filter((_, i) => i !== index))
        if (editingOptionIndex === index) setEditingOptionIndex(null)
    }

    // ——— Save product ———
    const handleSave = useCallback(async () => {
        if (!title.trim()) {
            setError('Product title is required')
            return
        }

        setSaving(true)
        setError(null)

        try {
            // Get store ID
            const { data: storeData } = await supabase
                .from('sites')
                .select('id')
                .eq('store_name', store)
                .single()

            if (!storeData) throw new Error('Store not found')

            // Insert product
            const { data: product, error: insertError } = await supabase
                .from('products')
                .insert({
                    store_id: storeData.id,
                    name: title.trim(),
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
                    tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
                    is_active: status === 'active',
                    variants: variantOptions.length > 0
                        ? variantOptions.map(opt => ({
                            name: opt.name,
                            options: Object.fromEntries(opt.values.map((v, i) => [String(i), v]))
                        }))
                        : [],
                })
                .select('id')
                .single()

            if (insertError) throw insertError

            // Insert variant options to product_options table if they exist
            if (variantOptions.length > 0 && product) {
                const optionInserts = variantOptions.map((opt, i) => ({
                    product_id: product.id,
                    name: opt.name,
                    position: i,
                    values: opt.values,
                }))

                await supabase
                    .from('product_options')
                    .insert(optionInserts)
            }

            router.push(`/${store}/products`)
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save product'
            setError(message)
        } finally {
            setSaving(false)
        }
    }, [
        title, description, images, category, price, comparePrice, costPerItem,
        chargeTax, quantity, trackInventory, sku, barcode, sellWhenOos,
        isPhysical, weight, weightUnit, countryOfOrigin, hsCode,
        urlHandle, seoTitle, seoDescription, productType, vendor, tags,
        status, variantOptions, store, supabase, router
    ])

    return (
        <div className="product-form-wrapper">
            {/* Header */}
            <div className="product-form-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link href={`/${store}/products`} className="product-form-back">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </Link>
                    <h1 className="product-form-title">Add product</h1>
                </div>
                <div className="product-form-actions">
                    <Link href={`/${store}/products`} className="setup-plan-banner-btn" style={{
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                        border: '1px solid var(--border)', padding: '8px 16px',
                        borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none'
                    }}>
                        Discard
                    </Link>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="setup-plan-banner-btn"
                        style={{
                            background: 'var(--text-primary)', color: 'var(--bg)',
                            padding: '8px 20px', borderRadius: 8, fontSize: 13,
                            fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.6 : 1, border: 'none'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{
                    padding: '10px 16px', marginBottom: 20, borderRadius: 8,
                    background: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)',
                    fontSize: 13, border: '1px solid rgba(239, 68, 68, 0.2)'
                }}>
                    {error}
                </div>
            )}

            {/* Two-column layout */}
            <div className="product-form-layout">
                {/* ——— Main Content ——— */}
                <div className="product-form-main">

                    {/* Title & Description */}
                    <div className="product-form-card">
                        <div className="product-field">
                            <label className="product-label">Title</label>
                            <input
                                type="text"
                                className="product-input"
                                placeholder="Short sleeve t-shirt"
                                value={title}
                                onChange={e => handleTitleChange(e.target.value)}
                            />
                        </div>
                        <div className="product-field">
                            <label className="product-label">Description</label>
                            <textarea
                                className="product-textarea"
                                placeholder="Write a detailed description of your product..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Media */}
                    <div className="product-form-card">
                        <h3>Media</h3>
                        <input
                            type="file"
                            ref={fileInputRef}
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleImageUpload}
                        />

                        {images.length > 0 && (
                            <div className="product-media-grid">
                                {images.map((img, i) => (
                                    <div key={i} className="product-media-item">
                                        <img src={img} alt={`Product ${i + 1}`} />
                                        <button
                                            className="product-media-remove"
                                            onClick={() => removeImage(i)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div
                            className="product-media-zone"
                            onClick={() => fileInputRef.current?.click()}
                            style={images.length > 0 ? { marginTop: 12 } : undefined}
                        >
                            <span className="material-symbols-outlined">
                                {uploading ? 'hourglass_top' : 'cloud_upload'}
                            </span>
                            <p>{uploading ? 'Uploading...' : 'Upload new · Select existing'}</p>
                            <p className="hint">Accepts images, videos</p>
                        </div>
                    </div>

                    {/* Category */}
                    <div className="product-form-card">
                        <h3>Category</h3>
                        <div className="product-field">
                            <input
                                type="text"
                                className="product-input"
                                placeholder="e.g. Clothing, Electronics, Accessories"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            />
                            <p className="product-hint">Determines tax rates and adds metadata</p>
                        </div>
                    </div>

                    {/* Pricing */}
                    <div className="product-form-card">
                        <h3>Pricing</h3>
                        <div className="product-field-row">
                            <div className="product-field">
                                <label className="product-label">Price</label>
                                <input
                                    type="number"
                                    className="product-input"
                                    placeholder="₹ 0.00"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <div className="product-field">
                                <label className="product-label">Compare-at price</label>
                                <input
                                    type="number"
                                    className="product-input"
                                    placeholder="₹ 0.00"
                                    value={comparePrice}
                                    onChange={e => setComparePrice(e.target.value)}
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                        <div className="product-field-row">
                            <div className="product-field">
                                <label className="product-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={chargeTax}
                                        onChange={e => setChargeTax(e.target.checked)}
                                    />
                                    Charge tax on this product
                                </label>
                            </div>
                        </div>
                        <div className="product-field">
                            <label className="product-label">Cost per item</label>
                            <input
                                type="number"
                                className="product-input"
                                placeholder="₹ 0.00"
                                value={costPerItem}
                                onChange={e => setCostPerItem(e.target.value)}
                                min="0"
                                step="0.01"
                            />
                            <p className="product-hint">Customers won&apos;t see this</p>
                        </div>
                    </div>

                    {/* Inventory */}
                    <div className="product-form-card">
                        <h3>Inventory</h3>
                        <div className="product-field">
                            <label className="product-checkbox">
                                <input
                                    type="checkbox"
                                    checked={trackInventory}
                                    onChange={e => setTrackInventory(e.target.checked)}
                                />
                                Track quantity
                            </label>
                        </div>
                        {trackInventory && (
                            <>
                                <div className="product-field" style={{ marginTop: 12 }}>
                                    <label className="product-label">Quantity</label>
                                    <input
                                        type="number"
                                        className="product-input"
                                        value={quantity}
                                        onChange={e => setQuantity(e.target.value)}
                                        min="0"
                                    />
                                </div>
                                <div className="product-field">
                                    <label className="product-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={sellWhenOos}
                                            onChange={e => setSellWhenOos(e.target.checked)}
                                        />
                                        Continue selling when out of stock
                                    </label>
                                </div>
                            </>
                        )}
                        <div className="product-field-row" style={{ marginTop: 12 }}>
                            <div className="product-field">
                                <label className="product-label">SKU (Stock Keeping Unit)</label>
                                <input
                                    type="text"
                                    className="product-input"
                                    placeholder=""
                                    value={sku}
                                    onChange={e => setSku(e.target.value)}
                                />
                            </div>
                            <div className="product-field">
                                <label className="product-label">Barcode (ISBN, UPC, GTIN)</label>
                                <input
                                    type="text"
                                    className="product-input"
                                    placeholder=""
                                    value={barcode}
                                    onChange={e => setBarcode(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Shipping */}
                    <div className="product-form-card">
                        <h3>Shipping</h3>
                        <div className="product-field">
                            <label className="product-checkbox">
                                <input
                                    type="checkbox"
                                    checked={isPhysical}
                                    onChange={e => setIsPhysical(e.target.checked)}
                                />
                                This is a physical product
                            </label>
                        </div>
                        {isPhysical && (
                            <>
                                <div className="product-field-row" style={{ marginTop: 12 }}>
                                    <div className="product-field">
                                        <label className="product-label">Weight</label>
                                        <input
                                            type="number"
                                            className="product-input"
                                            placeholder="0.0"
                                            value={weight}
                                            onChange={e => setWeight(e.target.value)}
                                            min="0"
                                            step="0.1"
                                        />
                                    </div>
                                    <div className="product-field">
                                        <label className="product-label">Unit</label>
                                        <select
                                            className="product-select"
                                            value={weightUnit}
                                            onChange={e => setWeightUnit(e.target.value)}
                                        >
                                            <option value="kg">kg</option>
                                            <option value="g">g</option>
                                            <option value="lb">lb</option>
                                            <option value="oz">oz</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="product-field-row">
                                    <div className="product-field">
                                        <label className="product-label">Country/Region of origin</label>
                                        <input
                                            type="text"
                                            className="product-input"
                                            placeholder="India"
                                            value={countryOfOrigin}
                                            onChange={e => setCountryOfOrigin(e.target.value)}
                                        />
                                    </div>
                                    <div className="product-field">
                                        <label className="product-label">HS (Harmonized System) code</label>
                                        <input
                                            type="text"
                                            className="product-input"
                                            placeholder=""
                                            value={hsCode}
                                            onChange={e => setHsCode(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Variants */}
                    <div className="product-form-card">
                        <h3>Variants</h3>
                        {variantOptions.map((option, optIndex) => (
                            <div key={optIndex} className="product-variant-option">
                                <div className="product-variant-option-header">
                                    <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                                        {option.name}
                                    </strong>
                                    <button
                                        onClick={() => removeOption(optIndex)}
                                        style={{
                                            background: 'none', border: 'none',
                                            color: 'var(--error)', fontSize: 13,
                                            cursor: 'pointer', fontWeight: 500
                                        }}
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div className="product-variant-values">
                                    {option.values.map((val, vi) => (
                                        <span key={vi} className="product-variant-tag">
                                            {val}
                                            <button onClick={() => removeValueFromOption(optIndex, vi)}>✕</button>
                                        </span>
                                    ))}
                                </div>

                                {editingOptionIndex === optIndex && (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                                        <input
                                            type="text"
                                            className="product-input"
                                            placeholder="Add value..."
                                            value={newOptionValue}
                                            onChange={e => setNewOptionValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    addValueToOption(optIndex)
                                                }
                                            }}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            onClick={() => addValueToOption(optIndex)}
                                            style={{
                                                padding: '8px 14px', borderRadius: 8,
                                                background: 'var(--text-primary)', color: 'var(--bg)',
                                                border: 'none', fontSize: 13, fontWeight: 500,
                                                cursor: 'pointer', whiteSpace: 'nowrap'
                                            }}
                                        >
                                            Add
                                        </button>
                                    </div>
                                )}

                                {editingOptionIndex !== optIndex && (
                                    <button
                                        onClick={() => setEditingOptionIndex(optIndex)}
                                        style={{
                                            marginTop: 8, background: 'none', border: 'none',
                                            color: 'var(--primary)', fontSize: 13,
                                            fontWeight: 500, cursor: 'pointer', padding: 0
                                        }}
                                    >
                                        + Add values
                                    </button>
                                )}
                            </div>
                        ))}

                        {showVariantBuilder ? (
                            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                <input
                                    type="text"
                                    className="product-input"
                                    placeholder="Option name (e.g. Size, Color)"
                                    value={newOptionName}
                                    onChange={e => setNewOptionName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            addVariantOption()
                                        }
                                    }}
                                    style={{ flex: 1 }}
                                />
                                <button
                                    onClick={addVariantOption}
                                    style={{
                                        padding: '8px 14px', borderRadius: 8,
                                        background: 'var(--text-primary)', color: 'var(--bg)',
                                        border: 'none', fontSize: 13, fontWeight: 500,
                                        cursor: 'pointer', whiteSpace: 'nowrap'
                                    }}
                                >
                                    Done
                                </button>
                                <button
                                    onClick={() => setShowVariantBuilder(false)}
                                    style={{
                                        padding: '8px 14px', borderRadius: 8,
                                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                                        border: '1px solid var(--border)', fontSize: 13,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowVariantBuilder(true)}
                                style={{
                                    background: 'none', border: 'none',
                                    color: 'var(--primary)', fontSize: 13,
                                    fontWeight: 500, cursor: 'pointer', padding: 0,
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    marginTop: variantOptions.length > 0 ? 8 : 0
                                }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                Add another option
                            </button>
                        )}
                    </div>

                    {/* SEO */}
                    <div className="product-form-card">
                        <h3>Search engine listing</h3>
                        <p className="product-hint" style={{ marginTop: -8, marginBottom: 14 }}>
                            Add a title and description to see how this product might appear in a search engine listing
                        </p>

                        {/* Preview */}
                        <div className="product-seo-preview">
                            <p className="product-seo-preview-url">
                                {store}.letbuyy.store/products/{urlHandle || '...'}
                            </p>
                            <p className="product-seo-preview-title">
                                {seoTitle || title || 'Page title'}
                            </p>
                            <p className="product-seo-preview-desc">
                                {seoDescription || description?.substring(0, 160) || 'Meta description will show here...'}
                            </p>
                        </div>

                        <div className="product-field">
                            <label className="product-label">Page title</label>
                            <input
                                type="text"
                                className="product-input"
                                placeholder={title || 'Page title'}
                                value={seoTitle}
                                onChange={e => setSeoTitle(e.target.value)}
                                maxLength={70}
                            />
                            <p className="product-char-count">{seoTitle.length} of 70 characters used</p>
                        </div>

                        <div className="product-field">
                            <label className="product-label">Meta description</label>
                            <textarea
                                className="product-textarea"
                                placeholder="Describe this product for search engines..."
                                value={seoDescription}
                                onChange={e => setSeoDescription(e.target.value)}
                                maxLength={160}
                                style={{ minHeight: 80 }}
                            />
                            <p className="product-char-count">{seoDescription.length} of 160 characters used</p>
                        </div>

                        <div className="product-field">
                            <label className="product-label">URL handle</label>
                            <input
                                type="text"
                                className="product-input"
                                value={urlHandle}
                                onChange={e => setUrlHandle(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* ——— Sidebar ——— */}
                <div className="product-form-sidebar">
                    {/* Status */}
                    <div className="product-form-card">
                        <h3>Status</h3>
                        <div className="product-field">
                            <select
                                className="product-select"
                                value={status}
                                onChange={e => setStatus(e.target.value as 'active' | 'draft')}
                            >
                                <option value="active">Active</option>
                                <option value="draft">Draft</option>
                            </select>
                        </div>
                    </div>

                    {/* Publishing */}
                    <div className="product-form-card">
                        <h3>Publishing</h3>
                        <label className="product-checkbox">
                            <input type="checkbox" checked={true} readOnly />
                            Online Store
                        </label>
                    </div>

                    {/* Product Organization */}
                    <div className="product-form-card">
                        <h3>Product organization</h3>
                        <div className="product-field">
                            <label className="product-label">Product type</label>
                            <input
                                type="text"
                                className="product-input"
                                placeholder="e.g. T-shirt"
                                value={productType}
                                onChange={e => setProductType(e.target.value)}
                            />
                        </div>
                        <div className="product-field">
                            <label className="product-label">Vendor</label>
                            <input
                                type="text"
                                className="product-input"
                                placeholder="e.g. Nike"
                                value={vendor}
                                onChange={e => setVendor(e.target.value)}
                            />
                        </div>
                        <div className="product-field">
                            <label className="product-label">Tags</label>
                            <input
                                type="text"
                                className="product-input"
                                placeholder="Vintage, cotton, summer (comma-separated)"
                                value={tags}
                                onChange={e => setTags(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
