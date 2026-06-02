'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { MaterialIcon } from '@letbuyy/ui'

export default function PreferencesPage() {
    const params = useParams()
    const store = params.store as string
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    // SEO fields
    const [seoTitle, setSeoTitle] = useState('')
    const [seoDescription, setSeoDescription] = useState('')

    // Social sharing
    const [ogImage, setOgImage] = useState('')

    // Password protection
    const [passwordEnabled, setPasswordEnabled] = useState(false)
    const [storePassword, setStorePassword] = useState('')
    const [passwordMessage, setPasswordMessage] = useState("We're coming soon! Stay tuned.")

    // Google Analytics
    const [gaId, setGaId] = useState('')

    // Favicon
    const [favicon, setFavicon] = useState('')

    useEffect(() => {
        const loadPrefs = async () => {
            const response = await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                cache: 'no-store',
            })
            const payload = await response.json()
            const storeData = payload.data

            if (storeData) {
                setSeoTitle(storeData.seo_title || storeData.store_name || storeData.name || '')
                setSeoDescription(storeData.seo_description || '')
            }
        }
        loadPrefs()
    }, [store])

    const handleSave = async () => {
        setSaving(true)
        try {
            await fetch(`/api/stores/${encodeURIComponent(store)}/settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    seo_title: seoTitle,
                    seo_description: seoDescription,
                }),
            })

            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (e) {
            console.error('Save error:', e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="online-store-page">
            <div className="os-page-header">
                <h1 className="os-page-title">Preferences</h1>
                <button className="os-btn os-btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : saved ? (
                        <>
                            <MaterialIcon name="check" size={14} aria-hidden="true" /> Saved
                        </>
                    ) : 'Save'}
                </button>
            </div>

            {/* Title & Meta Description */}
            <div className="os-pref-card">
                <h3 className="os-pref-card-title">Title and meta description</h3>
                <p className="os-pref-card-desc">
                    The title and meta description help define how your store shows up on search engines.
                </p>
                <div className="os-pref-field">
                    <label>Homepage title</label>
                    <input
                        type="text"
                        className="os-input"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        placeholder="My Store — Modern Fashion"
                    />
                    <span className="os-pref-char-count">{seoTitle.length} of 70 characters used</span>
                </div>
                <div className="os-pref-field">
                    <label>Meta description</label>
                    <textarea
                        className="os-textarea"
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                        placeholder="Describe your store for search engines..."
                        rows={3}
                    />
                    <span className="os-pref-char-count">{seoDescription.length} of 320 characters used</span>
                </div>

                {/* Search Preview */}
                <div className="os-seo-preview">
                    <div className="os-seo-preview-label">Search engine listing preview</div>
                    <div className="os-seo-preview-title">{seoTitle || 'Your Store Title'}</div>
                    <div className="os-seo-preview-url">{store}.letbuyy.store</div>
                    <div className="os-seo-preview-desc">{seoDescription || 'Your store description will appear here...'}</div>
                </div>
            </div>

            {/* Social Sharing */}
            <div className="os-pref-card">
                <h3 className="os-pref-card-title">Social sharing image</h3>
                <p className="os-pref-card-desc">
                    When you share a link to your store on social media, this image shows up.
                </p>
                <div className="os-pref-upload-area">
                    <MaterialIcon name="image" style={{ fontSize: 32, opacity: 0.3 }} />
                    <p>Drag and drop or click to upload</p>
                    <span className="os-pref-upload-hint">Recommended: 1200 × 628 pixels, PNG or JPG</span>
                </div>
            </div>

            {/* Password Protection */}
            {/* TODO: Password protection, Google Analytics, and Favicon fields
                are UI-only for now. Persistence will be added when the sites table
                schema is extended with these columns. */}
            <div className="os-pref-card">
                <h3 className="os-pref-card-title">Password protection</h3>
                <p className="os-pref-card-desc">
                    Restrict access to your store by enabling a password.
                </p>
                <div className="os-pref-toggle-row">
                    <label className="os-toggle">
                        <input
                            type="checkbox"
                            checked={passwordEnabled}
                            onChange={(e) => setPasswordEnabled(e.target.checked)}
                        />
                        <span className="os-toggle-slider" />
                    </label>
                    <span>Enable password</span>
                </div>
                {passwordEnabled && (
                    <>
                        <div className="os-pref-field">
                            <label>Password</label>
                            <input
                                type="password"
                                className="os-input"
                                value={storePassword}
                                onChange={(e) => setStorePassword(e.target.value)}
                                placeholder="Store password"
                            />
                        </div>
                        <div className="os-pref-field">
                            <label>Message for visitors</label>
                            <textarea
                                className="os-textarea"
                                value={passwordMessage}
                                onChange={(e) => setPasswordMessage(e.target.value)}
                                rows={2}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* Google Analytics */}
            <div className="os-pref-card">
                <h3 className="os-pref-card-title">Google Analytics</h3>
                <p className="os-pref-card-desc">
                    Track visitors and analyze traffic with Google Analytics.
                </p>
                <div className="os-pref-field">
                    <label>Measurement ID</label>
                    <input
                        type="text"
                        className="os-input"
                        value={gaId}
                        onChange={(e) => setGaId(e.target.value)}
                        placeholder="G-XXXXXXXXXX"
                    />
                </div>
            </div>

            {/* Favicon */}
            <div className="os-pref-card">
                <h3 className="os-pref-card-title">Favicon</h3>
                <p className="os-pref-card-desc">
                    The small icon shown in browser tabs and bookmarks.
                </p>
                <div className="os-pref-upload-area os-pref-favicon-upload">
                    <MaterialIcon name="star" style={{ fontSize: 24, opacity: 0.3 }} />
                    <p>Upload favicon (32×32px, .ico or .png)</p>
                </div>
            </div>
        </div>
    )
}
