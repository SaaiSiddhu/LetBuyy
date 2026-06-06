'use client'

import Link from 'next/link'
import { MaterialIcon } from '@letbuyy/ui'

interface EditorHeaderProps {
    storeName: string
    themeName: string
    themeId: string
    isDirty: boolean
    isSaving: boolean
    isPublishing: boolean
    canUndo: boolean
    canRedo: boolean
    onSave: () => void
    onPublish: () => void
    onUndo: () => void
    onRedo: () => void
}

export default function EditorHeader({
    storeName,
    themeName,
    isDirty,
    isSaving,
    isPublishing,
    canUndo,
    canRedo,
    onSave,
    onPublish,
    onUndo,
    onRedo,
}: EditorHeaderProps) {
    return (
        <header className="te-header">
            {/* Left: Back + Theme name */}
            <div className="te-header-left">
                <Link
                    href={`/${storeName}/online-store/themes`}
                    className="te-header-back"
                    title="Back to themes"
                >
                    <MaterialIcon name="arrow_back" />
                </Link>

                <div className="te-header-theme-info">
                    <MaterialIcon name="palette" className="te-header-theme-icon" />
                    <div className="te-header-theme-text">
                        <span className="te-header-theme-name">{themeName}</span>
                        <span className="te-header-theme-subtitle">Editing theme</span>
                    </div>
                </div>
            </div>

            {/* Center: Page selector */}
            <div className="te-header-center">
                <div className="te-header-page-selector">
                    <MaterialIcon name="description" size={18} />
                    <span>Home page</span>
                    <MaterialIcon name="expand_more" size={16} />
                </div>
            </div>

            {/* Right: Undo, Redo, Save */}
            <div className="te-header-right">
                <button
                    className="te-header-btn"
                    onClick={onUndo}
                    disabled={!canUndo}
                    title="Undo (Ctrl+Z)"
                >
                    <MaterialIcon name="undo" />
                </button>
                <button
                    className="te-header-btn"
                    onClick={onRedo}
                    disabled={!canRedo}
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <MaterialIcon name="redo" />
                </button>

                <button
                    className={`te-header-save ${isDirty ? 'te-header-save--dirty' : ''}`}
                    onClick={onSave}
                    disabled={isSaving || isPublishing || !isDirty}
                >
                    {isSaving ? (
                        <>
                            <span className="te-spinner" />
                            Saving…
                        </>
                    ) : (
                        'Save'
                    )}
                </button>
                <button
                    className="te-header-publish"
                    onClick={onPublish}
                    disabled={isSaving || isPublishing}
                >
                    {isPublishing ? (
                        <>
                            <span className="te-spinner" />
                            Publishing...
                        </>
                    ) : (
                        'Publish'
                    )}
                </button>
            </div>
        </header>
    )
}
