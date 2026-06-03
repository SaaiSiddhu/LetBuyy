'use client'

import { useCallback, useState, type ChangeEvent } from 'react'
import type { SchemaField } from '@/lib/theme-schemas'
import { MaterialIcon, useToast } from '@letbuyy/ui'

interface SchemaFormRendererProps {
    schema: Record<string, SchemaField>
    values: Record<string, unknown>
    onChange: (key: string, value: unknown) => void
    storeName?: string
}

export default function SchemaFormRenderer({ schema, values, onChange, storeName }: SchemaFormRendererProps) {
    return (
        <div className="te-form">
            {Object.entries(schema).map(([key, field]) => (
                <FieldRenderer
                    key={key}
                    fieldKey={key}
                    field={field}
                    value={values[key] ?? field.default ?? ''}
                    onChange={onChange}
                    storeName={storeName}
                />
            ))}
        </div>
    )
}

// --- Field Renderer ---

interface FieldRendererProps {
    fieldKey: string
    field: SchemaField
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

    switch (field.type) {
        case 'text':
            return (
                <TextInput
                    label={field.label}
                    value={String(value ?? '')}
                    maxLength={field.maxLength}
                    helpText={helpText}
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
                    onChange={handleChange}
                />
            )
        case 'radio':
            return (
                <RadioInput
                    label={field.label}
                    value={String(value ?? '')}
                    options={field.options || []}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
        case 'color':
            return (
                <ColorInput
                    label={field.label}
                    value={String(value ?? '#000000')}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
        case 'image':
            return (
                <ImageInput
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
                    value={String(value ?? '')}
                    options={field.options || []}
                    helpText={helpText}
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
                    onChange={handleChange}
                />
            )
        case 'number':
            return (
                <NumberInput
                    label={field.label}
                    value={Number(value ?? 0)}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
        default:
            return (
                <TextInput
                    label={field.label}
                    value={String(value ?? '')}
                    helpText={helpText}
                    onChange={handleChange}
                />
            )
    }
}

// ========== Field Components ==========

function FieldHelp({ helpText }: { helpText?: string }) {
    return helpText ? <span className="generic-theme-editor__field-help">{helpText}</span> : null
}

function TextInput({ label, value, maxLength, helpText, onChange }: { label: string; value: string; maxLength?: number; helpText?: string; onChange: (v: string) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <input
                type="text"
                className="te-field-input"
                value={value}
                maxLength={maxLength}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function TextareaInput({ label, value, maxLength, helpText, onChange }: { label: string; value: string; maxLength?: number; helpText?: string; onChange: (v: string) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <textarea
                className="te-field-textarea"
                value={value}
                maxLength={maxLength}
                rows={3}
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function ColorInput({ label, value, helpText, onChange }: { label: string; value: string; helpText?: string; onChange: (v: string) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <div className="te-field-color-wrapper">
                <input
                    type="color"
                    className="te-field-color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <input
                    type="text"
                    className="te-field-input te-field-color-text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    maxLength={9}
                />
            </div>
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function uploadedImageUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
        return null
    }

    const data = (payload as { data?: unknown }).data
    if (!data || typeof data !== 'object') {
        return null
    }

    const url = (data as { url?: unknown }).url
    return typeof url === 'string' && url.length > 0 ? url : null
}

function ImageInput({ label, value, onChange, storeName, helpText }: { label: string; value: string; onChange: (v: string) => void; storeName?: string; helpText?: string }) {
    const { notify } = useToast()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''

        if (!file) {
            return
        }

        if (!storeName) {
            const message = 'Store context is unavailable for uploads.'
            setUploadError(message)
            notify({
                title: 'Image upload unavailable',
                description: message,
                variant: 'warning',
            })
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
                const message = payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
                    ? (payload as { error: string }).error
                    : 'Image upload failed.'
                throw new Error(message)
            }

            onChange(url)
            notify({
                title: 'Image uploaded',
                description: `${label} is ready to save with this draft.`,
                variant: 'success',
            })
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Image upload failed.'
            setUploadError(message)
            notify({
                title: 'Image upload failed',
                description: message,
                variant: 'critical',
            })
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
                        <button
                            className="te-field-image-remove"
                            onClick={(e) => { e.preventDefault(); onChange('') }}
                            title="Remove image"
                        >
                            <MaterialIcon name="close" size={14} />
                        </button>
                    </div>
                ) : null}
                <input
                    type="text"
                    className="te-field-input"
                    value={value}
                    placeholder="Image URL…"
                    onChange={(e) => onChange(e.target.value)}
                />
                <label className={`te-field-upload-btn ${isUploading ? 'te-field-upload-btn--busy' : ''}`}>
                    <MaterialIcon name={isUploading ? 'hourglass_top' : 'cloud_upload'} size={16} />
                    {isUploading ? 'Uploading...' : 'Upload image'}
                    <input
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

function SelectInput({ label, value, options, helpText, onChange }: { label: string; value: string; options: string[]; helpText?: string; onChange: (v: string) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <select
                className="te-field-select"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ')}
                    </option>
                ))}
            </select>
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function RadioInput({ label, value, options, helpText, onChange }: { label: string; value: string; options: string[]; helpText?: string; onChange: (v: string) => void }) {
    return (
        <div className="te-field">
            <span className="te-field-label">{label}</span>
            <div className="te-field-radio-group">
                {options.map((opt) => (
                    <button
                        key={opt}
                        type="button"
                        className={`te-field-radio ${value === opt ? 'te-field-radio--selected' : ''}`}
                        onClick={() => onChange(opt)}
                    >
                        {opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ')}
                    </button>
                ))}
            </div>
            <FieldHelp helpText={helpText} />
        </div>
    )
}

function ToggleInput({ label, value, helpText, onChange }: { label: string; value: boolean; helpText?: string; onChange: (v: boolean) => void }) {
    return (
        <label className="te-field te-field--toggle">
            <span className="te-field-label">{label}</span>
            <button
                type="button"
                className={`te-toggle ${value ? 'te-toggle--on' : ''}`}
                onClick={() => onChange(!value)}
                role="switch"
                aria-checked={value}
            >
                <span className="te-toggle-thumb" />
            </button>
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function RangeInput({ label, value, min, max, step, unit, helpText, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; helpText?: string; onChange: (v: number) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <div className="te-field-range-wrapper">
                <input
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
        </label>
    )
}

function UrlInput({ label, value, helpText, onChange }: { label: string; value: string; helpText?: string; onChange: (v: string) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <input
                type="url"
                className="te-field-input"
                value={value}
                placeholder="https://…"
                onChange={(e) => onChange(e.target.value)}
            />
            <FieldHelp helpText={helpText} />
        </label>
    )
}

function NumberInput({ label, value, helpText, onChange }: { label: string; value: number; helpText?: string; onChange: (v: number) => void }) {
    return (
        <label className="te-field">
            <span className="te-field-label">{label}</span>
            <input
                type="number"
                className="te-field-input"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <FieldHelp helpText={helpText} />
        </label>
    )
}
