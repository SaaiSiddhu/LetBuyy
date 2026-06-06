// @letbuyy/ui — Shared React Components
// These components are designed to work with Tailwind CSS

export { Button } from './button';
export type { ButtonProps } from './button';

export { Input, Textarea } from './input';
export type { InputProps, TextareaProps } from './input';

export { DataTable, Badge } from './data-table';
export type { DataTableProps, Column, BadgeProps } from './data-table';

export {
    BlockStack,
    Box,
    Card,
    getPageIconName,
    InlineStack,
    letbuyyPageHeaderDefaults,
    Page,
    PageActions,
    PageContent,
    PageHeader,
    PageHeaderActions,
    PageShell,
    Section,
    Text,
} from './layout';
export type {
    BlockStackProps,
    BoxProps,
    CardProps,
    InlineStackProps,
    PageContentProps,
    PageHeaderAction,
    PageHeaderActionsProps,
    PageHeaderProps,
    PageIdentity,
    PageProps,
    PageShellProps,
    SectionProps,
    TextProps,
} from './layout';

export {
    Banner,
    EmptyState,
    EmptyStateIllustration,
    SaveBar,
    Skeleton,
    ToastProvider,
    useToast,
} from './feedback';
export type {
    BannerProps,
    EmptyStateKind,
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

export { Checkbox, ChoiceList, Combobox, Radio, Select, Tabs } from './controls';
export type {
    CheckboxProps,
    ChoiceListOption,
    ChoiceListProps,
    ComboboxProps,
    RadioProps,
    SelectOption,
    SelectProps,
    TabItem,
    TabsProps,
} from './controls';

export { Avatar, CommandPalette, FilterBar, IndexTable, MetricCard, Pagination, TableFilterBar } from './productivity';
export type {
    AvatarProps,
    CommandPaletteAction,
    CommandPaletteProps,
    FilterBarProps,
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

export {
    Breadcrumbs,
    Chart,
    DateRangePicker,
    DensityToggle,
    DescriptionList,
    Divider,
    FilterChips,
    ProgressBar,
    Spinner,
    TextStyle,
} from './primitives';
export type {
    BreadcrumbItem,
    BreadcrumbsProps,
    ChartDatum,
    ChartProps,
    DateRangePickerProps,
    DateRangeValue,
    DensityToggleProps,
    DescriptionListItem,
    DescriptionListProps,
    DividerProps,
    FilterChip,
    FilterChipsProps,
    ProgressBarProps,
    SpinnerProps,
    TextStyleProps,
} from './primitives';

export { DesignSystemRoot } from './design-system-root';
export type { DesignSystemRootProps } from './design-system-root';

export {
    letbuyyComponentTokens,
    letbuyyColorTokens,
    letbuyyDensityCssVariables,
    letbuyyDensityTokens,
    letbuyyPrimitiveTokens,
    letbuyySemanticTokens,
    letbuyyTokenCss,
    letbuyyTokenCssVariables,
    letbuyyTokens,
} from './tokens';
export type { LetbuyyDensity, LetbuyyTheme } from './tokens';

export { letbuyyFontCssVariables, letbuyyFontStacks } from './fonts';

export { formatInrCurrency } from './formatting';
export type { FormatInrCurrencyOptions } from './formatting';

export * from './icons';
