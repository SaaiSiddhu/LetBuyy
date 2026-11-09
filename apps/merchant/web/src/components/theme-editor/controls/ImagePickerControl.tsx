'use client'

import { useMediaUploadTarget } from '@/components/media/MediaRecoveryProvider'

/**
 * ImagePickerControl.tsx — Phase X: Image setting control with media library browsing.
 *
 * Wraps the ImageInput behaviour from SchemaFormRenderer.tsx verbatim
 * (URL text input + cloud_upload file button) and adds a "Browse Library" button
 * that opens the MediaLibrary picker overlay.
 *
 * BACKWARD COMPAT: plain URL entry still works identically to the pre-Phase-X
 * ImageInput.  Themes with plain image-URL settings render byte-identically.
 *
 * RISK-DUAL-N01: onChange emits the URL string only; never touches
 *   section_definitions or the schema object.
 *
 * Design ratchet:
 *   - Imports from @letbuyy/ui (Button, Input; Lucide icons)
 *   - --lb-* design tokens only; no raw rounded-[Npx] classes
 *   - No import from page.tsx, layout stylesheet, @letbuyy/api-client, @supabase
 *   - No unsafe inner HTML injection
 */

import { useCallback, useId, useState, type ChangeEvent } from 'react'
import { Images, LoaderCircle, Upload, X } from 'lucide-react'
import { Button, Input, useToast } from '@letbuyy/ui'
import { isUnsafeUrl } from '@/lib/theme-schemas'
import { MediaLibrary } from './MediaLibrary'
import styles from './controls.module.css'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImagePickerControlProps {
    label: string
    value: string
    /** RISK-DUAL-N01: emits URL string only; never touches section_definitions. */
    onChange: (v: string) => void
    storeName?: string
    helpText?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────



// ── Component ─────────────────────────────────────────────────────────────────

export function ImagePickerControl({
    label,
    value,
    onChange,
    storeName,
    helpText,
}: ImagePickerControlProps) {
    const id = useId()
    const mediaUpload = useMediaUploadTarget(storeName, id)
    const { notify } = useToast()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const [isLibraryOpen, setIsLibraryOpen] = useState(false)

    // ── Direct file upload (mirrors ImageInput in SchemaFormRenderer) ─────
    const handleFileChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file || mediaUpload.blocked) return

            if (!storeName) {
                const message = 'Store context is unavailable for uploads.'
                setUploadError(message)
                notify({ title: 'Image upload unavailable', description: message, variant: 'warning' })
                return
            }

            const current = mediaUpload.capture()
            setIsUploading(true)
            setUploadError(null)

            try {
                const asset = await mediaUpload.upload(file)
            const url = asset.url

            onChange(url)
                notify({
                    title: 'Image uploaded',
                    description: `${label} is ready to save with this draft.`,
                    variant: 'success',
                })
            } catch (err) {
                if (!current()) return
                const message = err instanceof Error ? err.message : 'Image upload failed.'
                setUploadError(message)
                notify({ title: 'Image upload failed', description: message, variant: 'critical' })
            } finally {
                if (current()) setIsUploading(false)
            }
        },
        [storeName, label, onChange, notify, mediaUpload.upload, mediaUpload.blocked, mediaUpload.capture]
    )

    // ── Library selection ─────────────────────────────────────────────────
    const handleLibrarySelect = useCallback(
        (url: string) => {
            // Guard against unsafe protocols from the library. R2 always produces
            // HTTPS CDN URLs in production, but local-dev data: URIs and any
            // hypothetical malicious DB value are caught here client-side.
            if (url && isUnsafeUrl(url)) return
            // RISK-DUAL-N01: onSelect emits URL only; never touches section_definitions
            onChange(url)
            setIsLibraryOpen(false)
            notify({
                title: 'Image selected',
                description: `${label} set from media library.`,
                variant: 'success',
            })
        },
        [onChange, label, notify]
    )

    return (
        <>
            <div className="te-field">
                <span className="te-field-label">{label}</span>
                <div className="te-field-image-wrapper">
                    {/* Thumbnail preview */}
                    {value ? (
                        <div className="te-field-image-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={value} alt="" className="te-field-image-thumb" />
                            <Button
                                unstyled
                                className="te-field-image-remove"
                                onClick={(e) => { e.preventDefault(); onChange('') }}
                                title="Remove image"
                                aria-label={`Remove ${label} image`}
                            >
                                <X  size={14} aria-hidden="true" />
                            </Button>
                        </div>
                    ) : null}

                    {/* URL text input (backward compat: plain URL entry unchanged) */}
                    <Input
                        unstyled
                        id={id}
                        type="text"
                        className="te-field-input"
                        value={value}
                        placeholder="Image URL…"
                        onChange={(e) => onChange(e.target.value)}
                        aria-label={`${label} image URL`}
                    />

                    {/* Upload button (identical to pre-Phase-X ImageInput) */}
                    <label
                        className={`te-field-upload-btn ${isUploading ? 'te-field-upload-btn--busy' : ''}`}
                    >
                        {isUploading ? <LoaderCircle size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
                        {isUploading ? 'Uploading...' : 'Upload image'}
                        <Input
                            unstyled
                            className="te-field-file-input"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            disabled={isUploading || mediaUpload.blocked}
                            onChange={handleFileChange}
                            aria-label="Upload image file"
                        />
                    </label>

                    {/* Browse library button (Phase X addition) */}
                    {storeName ? (
                        <Button
                            unstyled
                            type="button"
                            className={styles.browseLibraryBtn}
                            onClick={() => setIsLibraryOpen(true)}
                            aria-label={`Browse media library for ${label}`}
                        >
                            <Images size={15} aria-hidden />
                            Browse library
                        </Button>
                    ) : null}

                    {uploadError ? (
                        <p className="te-field-error" role="alert">{uploadError}</p>
                    ) : null}

                    {helpText ? (
                        <span className="generic-theme-editor__field-help">{helpText}</span>
                    ) : null}
                </div>
            </div>

            {/* Media library modal */}
            {isLibraryOpen && storeName ? (
                <MediaLibrary
                    storeName={storeName}
                    mediaType="image"
                    onSelect={handleLibrarySelect}
                    onClose={() => setIsLibraryOpen(false)}
                />
            ) : null}
        </>
    )
}
