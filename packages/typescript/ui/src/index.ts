// @letbuyy/ui — Shared React Components
// These components are designed to work with Tailwind CSS

export { Button } from './button';
export type { ButtonProps } from './button';

export { Input, Textarea } from './input';
export type { InputProps, TextareaProps } from './input';

export { DataTable, Badge } from './data-table';
export type { DataTableProps, Column, BadgeProps } from './data-table';

export { Page, PageHeader, Card, Section } from './layout';
export type { PageProps, PageHeaderAction, PageHeaderProps, CardProps, SectionProps } from './layout';

export {
    Banner,
    EmptyState,
    SaveBar,
    Skeleton,
    ToastProvider,
    useToast,
} from './feedback';
export type {
    BannerProps,
    EmptyStateProps,
    SaveBarProps,
    SkeletonProps,
    StatusVariant,
    ToastMessage,
    ToastProviderProps,
    ToastVariant,
} from './feedback';

export { ConfirmDialog, Modal, Tooltip } from './overlays';
export type { ConfirmDialogProps, ModalProps, TooltipProps } from './overlays';

export { Combobox, Select, Tabs } from './controls';
export type { ComboboxProps, SelectOption, SelectProps, TabItem, TabsProps } from './controls';

export { Avatar, CommandPalette, IndexTable, MetricCard, Pagination } from './productivity';
export type {
    AvatarProps,
    CommandPaletteAction,
    CommandPaletteProps,
    IndexTableBulkAction,
    IndexTableColumn,
    IndexTableProps,
    MetricCardProps,
    PaginationProps,
} from './productivity';

export { ColorPreviewBlock, ColorPreviewButton, ColorPreviewSurface, ColorSwatch, RadiusPreview } from './visual';
export type {
    ColorPreviewBlockProps,
    ColorPreviewButtonProps,
    ColorPreviewSurfaceProps,
    ColorSwatchProps,
    RadiusPreviewProps,
} from './visual';

export { DesignSystemRoot } from './design-system-root';
export type { DesignSystemRootProps } from './design-system-root';

export {
    letbuyyTokenCss,
    letbuyyTokenCssVariables,
    letbuyyTokens,
} from './tokens';
export type { LetbuyyTheme } from './tokens';

export { letbuyyFontCssVariables, letbuyyFontStacks } from './fonts';

export * from './icons';
