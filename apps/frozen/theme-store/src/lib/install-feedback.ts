export type InstallErrorCode = '' | 'missing_store' | 'purchase_required' | 'install_failed' | string;
export function installErrorMessage(error: InstallErrorCode) {
    if (error === 'purchase_required') return 'Purchase this theme before installing it.';
    if (error === 'missing_store') return 'Choose a store before installing.';
    if (error === 'missing_confirmation') return 'Confirm the install impact before continuing.';
    if (error === 'selection_unavailable') return 'Reload theme details to confirm the exact package version before adding it.';
    if (error === 'version_conflict') return 'The selected version changed, or your library has another version. Review the theme in your library before continuing.';
    if (error === 'install_unconfirmed') return 'The instance and package version were not confirmed. Check this store’s library and retry the same Add request.';
    if (error === 'install_failed') return 'Theme installation failed. Check your library and retry the same request.';
    return 'Theme installation could not be completed.';
}
