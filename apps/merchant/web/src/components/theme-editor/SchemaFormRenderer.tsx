'use client'

/**
 * SchemaFormRenderer.tsx — Phase U: Shopify-parity theme setting controls
 *
 * Renders a settings form from an ExtendedSchemaField schema map.
 *
 * RISK-DUAL-N01: controls receive (value, onChange) only.  They never receive
 * or mutate the schema/definition object. The onChange callback writes to the
 * instance settings value — never to the schema.
 *
 * Conditional visibility: fields with visible_if are only rendered when the
 * referenced sibling field has the specified value (isFieldVisible helper).
 *
 * Unknown field types retain their saved values in a read-only output. All frozen SchemaField type values render identically
 * to the pre-Phase-U implementation.
 *
 * Descriptors use the canonical extension adapter, including typed options and
 * conditional metadata. Values remain instance data; no schema is edited here.
 */

import { LoaderCircle, Upload, X } from 'lucide-react'
import { useCallback, useState, useId, type ChangeEvent } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { isFieldVisible, isUnsafeUrl, validateFieldValue, resolveFieldDefault } from '@/lib/theme-schemas'
import { resolveFieldOptions } from '@letbuyy/theme-engine'
import { Button, Input, letbuyyPrimitiveTokens, useToast } from '@letbuyy/ui'
// Phase U new control components
import { CheckboxControl } from './controls/CheckboxControl'
import { ColorBackgroundControl } from './controls/ColorBackgroundControl'
import { ColorSchemeControl } from './controls/ColorSchemeControl'
import { FontPickerControl } from './controls/FontPickerControl'
import { HtmlControl } from './controls/HtmlControl'
import { LiquidControl } from './controls/LiquidControl'
import { VideoControl } from './controls/VideoControl'
import { VideoUrlControl } from './controls/VideoUrlControl'
import { FieldHeader, FieldParagraph } from './controls/InfoControls'
import { ResourcePickerControl } from './controls/ResourcePickerControl'
// Phase X: image browsing via MediaLibrary picker
import { ImagePickerControl } from './controls/ImagePickerControl'

interface SchemaFormRendererProps {
    schema: Record<string, ExtendedSchemaField>
    values: Record<string, unknown>
    onChange: (key: string, value: unknown) => void
    storeName?: string
}

export default function SchemaFormRenderer({ schema, values, onChange, storeName }: SchemaFormRendererProps) {
    return (
        <div className="te-form">
            {Object.entries(schema).map(([key, field]) => {
                // Conditional visibility: skip fields whose visible_if constraint is not met
                if (!isFieldVisible(field, values)) return null

                // Type-safe default: use resolveFieldDefault instead of '' coercion for
                // boolean/number types (fixes the type-unsafe default fallback)
                const storedValue = values[key]
                const resolvedValue = storedValue !== undefined ? storedValue : resolveFieldDefault(field)

                return (
                    <FieldRenderer
                        key={key}
                        fieldKey={key}
                        field={field}
                        value={resolvedValue}
                        onChange={onChange}
                        storeName={storeName}
                    />
                )
            })}
        </div>
    )
}

// --- Field Renderer ---

interface FieldRendererProps {
    fieldKey: string
    field: ExtendedSchemaField
    value: unknown
    onChange: (key: string, value: unknown) => void
    storeName?: string
}

function FieldRenderer({ fieldKey, field, value, onChange, storeName }: FieldRendererProps) {
    const handleChange = useCallback(
        (v: unknown) => onChange(fieldKey, v),
        [fieldKey, onChange]
    )
    const helpText = field.info || field.description
    if (field.readOnlyReason) return <PreservedSetting label={field.label} value={value} reason={field.readOnlyReason} />

    switch (field.type) {
        // ── Frozen types (preserved byte-identically) ──────────────────────────────
        case 'text':
            return (
                <TextInput
                    label={field.label}
                    value={String(value ?? '')}
                    maxLength={field.maxLength}
                    helpText={helpText}
                    required={field.required}
                    onChange={handleChange}
                />
            )
        case 'textarea':
        case 'richtext':
            return (
                <TextareaInput
                    label={field.label}
                    value={String(value ?? '')}
                    maxLength={field.maxLength}
                    helpText={helpText}
                    required={field.required}
                    onChange={handleChange}
                />
            )
        case 'radio':
            return (
                <RadioInput
                    label={field.label}
                    value={value}
                    options={field.options || []}
                    helpText={helpText}
                    required={field.required}
                    onChange={handleChange}
                />
            )
        case 'color':
            return (
                <ColorInput
                    label={field.label}
                    value={String(value ?? letbuyyPrimitiveTokens.color.black)}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
        case 'image':
            // Phase X: replaced with ImagePickerControl (adds Browse Library button).
            // Backward compat: plain URL entry works identically (RISK-DUAL-N01 preserved).
            return (
                <ImagePickerControl
                    label={field.label}
                    value={String(value ?? '')}
                    onChange={handleChange}
                    storeName={storeName}
                    helpText={helpText}
                />
            )
        case 'select':
            return (
                <SelectInput
                    label={field.label}
                    value={value}
                    options={field.options || []}
                    helpText={helpText}
                    required={field.required}
                    onChange={handleChange}
                />
            )
        case 'toggle':
            return (
                <ToggleInput
                    label={field.label}
                    value={Boolean(value)}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
        case 'range':
            return (
                <RangeInput
                    label={field.label}
                    value={Number(value ?? field.min ?? 0)}
                    min={field.min ?? 0}
                    max={field.max ?? 100}
                    step={field.step ?? 1}
                    unit={field.unit}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
        case 'url':
            return (
                <UrlInput
                    label={field.label}
                    value={String(value ?? '')}
                    helpText={helpText}
                    required={field.required}
                    onChange={handleChange}
                />
            )
        case 'number':
            return (
                // Phase U fix: pass min/max/step from schema (previously ignored)
                <NumberInput
                    label={field.label}
                    value={Number(value ?? field.min ?? 0)}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    helpText={helpText}
                    required={field.required}
                    onChange={handleChange}
                />
            )

        // ── Phase U new types ─────────────────────────────────────────────────────
        case 'color_background':
            return (
                <ColorBackgroundControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                />
            )
        case 'color_scheme':
            return (
                <ColorSchemeControl
                    field={field}
                    value={value}
                    onChange={handleChange}
                />
            )
        case 'font_picker':
            return (
                <FontPickerControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                />
            )
        case 'html':
            return (
                <HtmlControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                />
            )
        case 'liquid':
            return (
                <LiquidControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                />
            )
        case 'checkbox':
            return (
                <CheckboxControl
                    field={field}
                    value={Boolean(value)}
                    onChange={handleChange}
                />
            )
        case 'video':
            return (
                <VideoControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                    storeName={storeName}
                />
            )
        case 'video_url':
            return (
                <VideoUrlControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                />
            )
        case 'header':
            return <FieldHeader field={field} />
        case 'paragraph':
            return <FieldParagraph field={field} />

        // Resource pickers: product / collection / blog / page / menu
        // Phase W: pass storeName so ResourcePickerControl can use live search.
        case 'product':
        case 'collection':
        case 'blog':
        case 'page':
        case 'menu':
            return (
                <ResourcePickerControl
                    field={field}
                    value={String(value ?? '')}
                    onChange={handleChange}
                    storeName={storeName}
                />
            )

        // ── Default / unknown / legacy field types ────────────────────────────────
        // An unsupported descriptor must never coerce a saved object into text.
        default:
            return <PreservedSetting label={field.label} value={value} reason="This setting is not supported. Its saved value is preserved." />
    }
}

function PreservedSetting({ label, value, reason }: { label: string; value: unknown; reason: string }) {
    return <div className="te-field"><span className="te-field-label">{label}</span><p className="generic-theme-editor__field-help">{reason}</p><output aria-label={`${label} saved value`}>{typeof value === 'string' ? value : JSON.stringify(value ?? null)}</output></div>
}

// ========== Field Components ==========

function FieldHelp({ helpText }: { helpText?: string }) {
    return helpText ? <span className="generic-theme-editor__field-help">{helpText}</span> : null
}

function FieldError({ id, error }: { id: string; error: string | null }) {
    if (!error) return null
    return (
        <p id={id} className="te-field-error" role="alert">
            {error}
        </p>
    )
}

function RequiredMark() {
    return (
        <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
    )
}

function TextInput({
    label, value, maxLength, helpText, required, onChange,
}: {
    label: string
    value: string
    maxLength?: number
    helpText?: string
    required?: boolean
    onChange: (v: string) => void
}) {
    const id = useId()
    const error = required && !value ? `${label} is required` : null
    return (
        <label className="te-field" htmlFor={id}>
            <span className="te-field-label">
                {label}
                {required ? <RequiredMark /> : null}
            </span>
            <Input unstyled
                id={id}
                type="text"
                className="te-field-input"
                value={value}
                maxLength={maxLength}
                onChange={(e) => onChange(e.target.value)}
                aria-required={required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
            />
            <FieldError id={`${id}-error`} error={error} />
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function TextareaInput({
    label, value, maxLength, helpText, required, onChange,
}: {
    label: string
    value: string
    maxLength?: number
    helpText?: string
    required?: boolean
    onChange: (v: string) => void
}) {
    const id = useId()
    const error = required && !value ? `${label} is required` : null
    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {label}
                {required ? <RequiredMark /> : null}
            </label>
            <textarea
                id={id}
                className="te-field-textarea"
                value={value}
                maxLength={maxLength}
                rows={3}
                onChange={(e) => onChange(e.target.value)}
                aria-required={required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
            />
            <FieldError id={`${id}-error`} error={error} />
            <FieldHelp helpText={helpText} />
        </div>
    )
}

function ColorInput({
    label, value, helpText, onChange,
}: {
    label: string
    value: string
    helpText?: string
    onChange: (v: string) => void
}) {
    const id = useId()
    return (
        <div className="te-field">
            <label htmlFor={`${id}-text`} className="te-field-label">{label}</label>
            <div className="te-field-color-wrapper">
                <Input unstyled
                    id={id}
                    type="color"
                    className="te-field-color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={`${label} colour picker`}
                />
                <Input unstyled
                    id={`${id}-text`}
                    type="text"
                    className="te-field-input te-field-color-text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={9}
                />
            </div>
            <FieldHelp helpText={helpText} />
        </div>
    )
}

function uploadedImageUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const data = (payload as { data?: unknown }).data
    if (!data || typeof data !== 'object') return null
    const url = (data as { url?: unknown }).url
    return typeof url === 'string' && url.length > 0 ? url : null
}

function ImageInput({
    label, value, onChange, storeName, helpText,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    storeName?: string
    helpText?: string
}) {
    const { notify } = useToast()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        if (!storeName) {
            const message = 'Store context is unavailable for uploads.'
            setUploadError(message)
            notify({ title: 'Image upload unavailable', description: message, variant: 'warning' })
            return
        }

        setIsUploading(true)
        setUploadError(null)

        try {
            const formData = new FormData()
            formData.append('file', file)
            const response = await fetch(`/api/stores/${encodeURIComponent(storeName)}/upload`, {
                method: 'POST',
                body: formData,
            })
            const payload = await response.json().catch(() => null)
            const url = uploadedImageUrl(payload)
            if (!response.ok || !url) {
                const message =
                    payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
                        ? (payload as { error: string }).error
                        : 'Image upload failed.'
                throw new Error(message)
            }
            onChange(url)
            notify({ title: 'Image uploaded', description: `${label} is ready to save with this draft.`, variant: 'success' })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Image upload failed.'
            setUploadError(message)
            notify({ title: 'Image upload failed', description: message, variant: 'critical' })
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="te-field">
            <span className="te-field-label">{label}</span>
            <div className="te-field-image-wrapper">
                {value ? (
                    <div className="te-field-image-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={value} alt="" className="te-field-image-thumb" />
                        <Button unstyled
                            className="te-field-image-remove"
                            onClick={(e) => { e.preventDefault(); onChange('') }}
                            title="Remove image"
                        >
                            <X  size={14} aria-hidden="true" />
                        </Button>
                    </div>
                ) : null}
                <Input unstyled
                    type="text"
                    className="te-field-input"
                    value={value}
                    placeholder="Image URL…"
                    onChange={(e) => onChange(e.target.value)}
                />
                <label className={`te-field-upload-btn ${isUploading ? 'te-field-upload-btn--busy' : ''}`}>
                    {isUploading ? <LoaderCircle size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                    {isUploading ? 'Uploading...' : 'Upload image'}
                    <Input unstyled
                        className="te-field-file-input"
                        type="file"
                        accept="image/*"
                        disabled={isUploading}
                        onChange={handleFileChange}
                    />
                </label>
                {uploadError ? <p className="te-field-error">{uploadError}</p> : null}
                <FieldHelp helpText={helpText} />
            </div>
        </div>
    )
}

function SelectInput({
    label, value, options, helpText, required, onChange,
}: {
    label: string
    value: unknown
    options: ExtendedSchemaField['options']
    helpText?: string
    required?: boolean
    onChange: (v: string | number | boolean) => void
}) {
    const id = useId()
    const choices = resolveFieldOptions({ options })
    const selected = choices.findIndex(option => Object.is(option.value, value))
    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {label}
                {required ? <RequiredMark /> : null}
            </label>
            <select
                id={id}
                className="te-field-select"
                value={selected < 0 ? '' : String(selected)}
                onChange={(e) => { const choice = choices[Number(e.target.value)]; if (e.target.value !== '' && choice) onChange(choice.value) }}
                aria-required={required ? 'true' : undefined}
            >
                <option value="" disabled>{value === undefined || value === '' ? 'Choose an option' : 'Saved value unavailable'}</option>
                {choices.map((option, index) => (
                    <option key={index} value={String(index)}>
                        {option.label}
                    </option>
                ))}
            </select>
            <FieldHelp helpText={helpText} />
        </div>
    )
}

function RadioInput({
    label, value, options, helpText, required, onChange,
}: {
    label: string
    value: unknown
    options: ExtendedSchemaField['options']
    helpText?: string
    required?: boolean
    onChange: (v: string | number | boolean) => void
}) {
    const choices = resolveFieldOptions({ options })
    return (
        <div className="te-field" role="group" aria-label={label}>
            <span className="te-field-label">
                {label}
                {required ? <RequiredMark /> : null}
            </span>
            <div className="te-field-radio-group">
                {choices.map((option, index) => (
                    <Button unstyled
                        key={index}
                        type="button"
                        role="radio"
                        aria-checked={Object.is(value, option.value)}
                        className={`te-field-radio ${Object.is(value, option.value) ? 'te-field-radio--selected' : ''}`}
                        onClick={() => onChange(option.value)}
                    >
                        {option.label}
                    </Button>
                ))}
            </div>
            <FieldHelp helpText={helpText} />
        </div>
    )
}

function ToggleInput({
    label, value, helpText, onChange,
}: {
    label: string
    value: boolean
    helpText?: string
    onChange: (v: boolean) => void
}) {
    return (
        <label className="te-field te-field--toggle">
            <span className="te-field-label">{label}</span>
            <Button unstyled
                type="button"
                className={`te-toggle ${value ? 'te-toggle--on' : ''}`}
                onClick={() => onChange(!value)}
                role="switch"
                aria-checked={value}
            >
                <span className="te-toggle-thumb" />
            </Button>
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function RangeInput({
    label, value, min, max, step, unit, helpText, onChange,
}: {
    label: string
    value: number
    min: number
    max: number
    step: number
    unit?: string
    helpText?: string
    onChange: (v: number) => void
}) {
    const id = useId()
    return (
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">{label}</label>
            <div className="te-field-range-wrapper">
                <Input unstyled
                    id={id}
                    type="range"
                    className="te-field-range"
                    value={value}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                <span className="te-field-range-value">
                    {step < 1 ? value.toFixed(1) : value}{unit || ''}
                </span>
            </div>
            <FieldHelp helpText={helpText} />
        </div>
    )
}

function UrlInput({
    label, value, helpText, required, onChange,
}: {
    label: string
    value: string
    helpText?: string
    required?: boolean
    onChange: (v: string) => void
}) {
    const id = useId()
    // Phase U fix: validate against unsafe protocols (previously no guard)
    const unsafeError = value.length > 0 && isUnsafeUrl(value) ? `${label} contains an unsafe URL protocol` : null
    const requiredError = required && !value ? `${label} is required` : null
    const error = unsafeError || requiredError

    const handleChange = (raw: string) => {
        // Block unsafe protocols immediately at change time
        if (raw.length > 0 && isUnsafeUrl(raw)) return
        onChange(raw)
    }

    return (
        <label className="te-field" htmlFor={id}>
            <span className="te-field-label">
                {label}
                {required ? <RequiredMark /> : null}
            </span>
            <Input unstyled
                id={id}
                type="url"
                className="te-field-input"
                value={value}
                placeholder="https://…"
                onChange={(e) => handleChange(e.target.value)}
                aria-required={required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
            />
            <FieldError id={`${id}-error`} error={error} />
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function NumberInput({
    label, value, min, max, step, helpText, required, onChange,
}: {
    label: string
    value: number
    min?: number
    max?: number
    step?: number
    helpText?: string
    required?: boolean
    onChange: (v: number) => void
}) {
    const id = useId()
    // Phase U fix: enforce min/max/step from schema (previously ignored)
    let error: string | null = null
    if (min !== undefined && value < min) error = `${label} must be at least ${min}`
    if (max !== undefined && value > max) error = `${label} must be at most ${max}`

    return (
        <label className="te-field" htmlFor={id}>
            <span className="te-field-label">
                {label}
                {required ? <RequiredMark /> : null}
            </span>
            <Input unstyled
                id={id}
                type="number"
                className="te-field-input"
                value={value}
                min={min}
                max={max}
                step={step}
                onChange={(e) => onChange(Number(e.target.value))}
                aria-required={required ? 'true' : undefined}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
            />
            <FieldError id={`${id}-error`} error={error} />
            <FieldHelp helpText={helpText} />
        </label>
    )
}
