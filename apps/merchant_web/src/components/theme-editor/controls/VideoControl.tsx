'use client'

/**
 * VideoControl.tsx — Phase U: Video file URL entry + upload
 *
 * Renders a URL text input plus a file upload button for video/* files.
 * Mirrors the ImageInput pattern from SchemaFormRenderer.tsx.
 *
 * - URL field: guards against unsafe protocols (isUnsafeUrl check).
 * - File upload: posts to /api/stores/[store]/upload (same endpoint as image).
 * - storeName-gated: upload is disabled without storeName context.
 * - Phase X: "Browse Library" button opens MediaLibrary with mediaType='video'.
 *   All existing behaviour (URL entry, file upload) is unchanged (additive only).
 *
 * RISK-DUAL-N01: receives value + onChange; never mutates the schema object.
 */

import { useState, useId, useCallback, type ChangeEvent } from 'react'
import type { ExtendedSchemaField } from '@/lib/theme-schemas'
import { validateFieldValue, isUnsafeUrl } from '@/lib/theme-schemas'
import { Button, Input, MaterialIcon } from '@letbuyy/ui'
import { MediaLibrary } from './MediaLibrary'
import styles from './controls.module.css'

interface VideoControlProps {
    field: ExtendedSchemaField
    value: string
    onChange: (v: string) => void
    storeName?: string
}

function extractUploadedUrl(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') return null
    const data = (payload as { data?: unknown }).data
    if (!data || typeof data !== 'object') return null
    const url = (data as { url?: unknown }).url
    return typeof url === 'string' && url.length > 0 ? url : null
}

export function VideoControl({ field, value, onChange, storeName }: VideoControlProps) {
    const id = useId()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    // Phase X: media library state
    const [isLibraryOpen, setIsLibraryOpen] = useState(false)
    const schemaError = validateFieldValue(field, value)
    const error = schemaError || uploadError
    const helpText = field.info || field.description

    // Phase X: handle selection from media library
    const handleLibrarySelect = useCallback(
        (url: string) => {
            // Guard against unsafe protocols from the library (mirrors handleUrlChange
            // which already rejects unsafe URLs on manual text entry). Mitigated in
            // production by R2 always producing HTTPS CDN URLs, but adding the check
            // here closes the gap for local-dev data: URIs or a hypothetical DB
            // insertion of a malicious URL.
            if (url && isUnsafeUrl(url)) return
            // RISK-DUAL-N01: emit URL only; never touches section_definitions
            onChange(url)
            setIsLibraryOpen(false)
        },
        [onChange]
    )

    const handleUrlChange = (raw: string) => {
        // Reject unsafe protocols immediately
        if (raw.length > 0 && isUnsafeUrl(raw)) return
        onChange(raw)
    }

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        if (!storeName) {
            setUploadError('Store context is unavailable for uploads.')
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
            const url = extractUploadedUrl(payload)

            if (!response.ok || !url) {
                const msg =
                    payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
                        ? (payload as { error: string }).error
                        : 'Video upload failed.'
                throw new Error(msg)
            }

            onChange(url)
        } catch (err) {
            setUploadError(err instanceof Error ? err.message : 'Video upload failed.')
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <>
        <div className="te-field">
            <label htmlFor={id} className="te-field-label">
                {field.label}
                {field.required ? (
                    <span aria-label="required" style={{ color: 'var(--error, rgb(239 68 68))', marginLeft: 2 }}>*</span>
                ) : null}
            </label>

            <div className={styles.videoWrapper}>
                <Input
                    unstyled
                    id={id}
                    type="url"
                    className="te-field-input"
                    value={value}
                    placeholder="https://…/video.mp4"
                    onChange={(e) => handleUrlChange(e.target.value)}
                    aria-required={field.required ? 'true' : undefined}
                    aria-invalid={error ? 'true' : undefined}
                    aria-describedby={error ? `${id}-error` : helpText ? `${id}-help` : undefined}
                />

                <label className={`te-field-upload-btn ${isUploading ? 'te-field-upload-btn--busy' : ''}`}>
                    <MaterialIcon name={isUploading ? 'hourglass_top' : 'video_call'} size={16} aria-hidden />
                    {isUploading ? 'Uploading…' : 'Upload video'}
                    <Input
                        unstyled
                        className="te-field-file-input"
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        disabled={isUploading}
                        onChange={handleFileChange}
                        aria-label="Upload video file"
                    />
                </label>

                {/* Phase X: Browse library button (additive — all existing behaviour unchanged) */}
                {storeName ? (
                    <Button
                        unstyled
                        type="button"
                        className={styles.browseLibraryBtn}
                        onClick={() => setIsLibraryOpen(true)}
                        aria-label={`Browse media library for ${field.label}`}
                    >
                        <MaterialIcon name="video_library" size={15} aria-hidden />
                        Browse library
                    </Button>
                ) : null}

                {error ? (
                    <p id={`${id}-error`} className={styles.fieldError} role="alert">
                        <MaterialIcon name="error" size={12} aria-hidden />
                        {' '}{error}
                    </p>
                ) : null}
                {helpText && !error ? (
                    <span id={`${id}-help`} className="generic-theme-editor__field-help">{helpText}</span>
                ) : null}
            </div>
        </div>

        {/* Phase X: MediaLibrary modal — rendered outside the field div for correct stacking */}
        {isLibraryOpen && storeName ? (
            <MediaLibrary
                storeName={storeName}
                mediaType="video"
                onSelect={handleLibrarySelect}
                onClose={() => setIsLibraryOpen(false)}
            />
        ) : null}
        </>
    )
}
