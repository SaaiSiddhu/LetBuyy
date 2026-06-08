// @letbuyy/ui — Shared React Components
// These components are designed to work with Tailwind CSS

export { Button } from './button';
export type { ButtonProps } from './button';

export { InlineError, Input, NumberField, Textarea } from './input';
export type { InlineErrorProps, InputProps, NumberFieldProps, TextareaProps } from './input';

export { Table } from './table';
export type { TableBulkAction, TableColumn, TableFilterChip, TableProps, TableSavedView } from './table';

export {
    BlockStack,
    Box,
    Card,
    Columns,
    Container,
    getPageIconName,
    Grid,
    InlineStack,
    letbuyyPageHeaderDefaults,
    letbuyyPageIdentityIcons,
    letbuyyPageIdentityOptions,
    Page,
    PageContent,
    PageHeader,
    PageHeaderActions,
    resolvePageIdentity,
    Section,
    Text,
} from './layout';
export type {
    BlockStackProps,
    BoxProps,
    CardProps,
    ColumnsProps,
    ContainerProps,
    GridProps,
    InlineStackProps,
    PageContentProps,
    PageHeaderAction,
    PageHeaderActionsProps,
    PageHeaderProps,
    PageIdentity,
    PageIdentityOption,
    PageProps,
    SectionProps,
    SpaceScale,
    TextProps,
} from './layout';

export {
    Badge,
    Banner,
    EmptyState,
    EmptyStateIllustration,
    SaveBar,
    Skeleton,
    ToastProvider,
    useToast,
} from './feedback';
export type {
    BadgeProps,
    BannerProps,
    EmptyStateKind,
    EmptyStateIllustrationProps,
    EmptyStateProps,
    SaveBarProps,
    SkeletonProps,
    StatusVariant,
    ToastMessage,
    ToastPlacement,
    ToastProviderProps,
    ToastVariant,
} from './feedback';

export { ConfirmDialog, Drawer, Dropdown, DropdownMenu, Modal, Popover, Tooltip } from './overlays';
export type { ConfirmDialogProps, DrawerProps, DropdownItem, DropdownProps, ModalProps, OverlayTrigger, OverlayTriggerProps, PopoverProps, TooltipProps } from './overlays';

export { Checkbox, ChoiceList, Combobox, Radio, Select, Switch, Tabs } from './controls';
export type {
    CheckboxProps,
    ChoiceListOption,
    ChoiceListProps,
    ComboboxProps,
    RadioProps,
    SelectOption,
    SelectProps,
    SwitchProps,
    TabItem,
    TabsProps,
} from './controls';

export { AppFrame, Navigation, Sidebar } from './app-shell';
export type { AppFrameProps, NavigationItem, NavigationProps, SidebarProps } from './app-shell';

export { Avatar, CommandPalette, FilterBar, MetricCard, Pagination } from './productivity';
export type {
    AvatarProps,
    CommandPaletteAction,
    CommandPaletteProps,
    FilterBarProps,
    MetricCardProps,
    PaginationProps,
} from './productivity';

export {
    Breadcrumbs,
    Chart,
    Accordion,
    DateRangePicker,
    DatePicker,
    DensityToggle,
    DescriptionList,
    Disclosure,
    Divider,
    FilterChips,
    ProgressBar,
    SegmentedControl,
    Spinner,
} from './primitives';
export type {
    AccordionItem,
    AccordionProps,
    BreadcrumbItem,
    BreadcrumbsProps,
    ChartDatum,
    ChartProps,
    DateRangePickerProps,
    DateRangeValue,
    DatePickerProps,
    DensityToggleProps,
    DescriptionListItem,
    DescriptionListProps,
    DisclosureProps,
    DividerProps,
    FilterChip,
    FilterChipsProps,
    ProgressBarProps,
    SegmentedControlOption,
    SegmentedControlProps,
    SpinnerProps,
} from './primitives';

export {
    ColorPreviewBlock,
    ColorPreviewButton,
    ColorPreviewSurface,
    ColorSwatch,
    RadiusPreview,
} from './preview';
export type {
    ColorPreviewBlockProps,
    ColorPreviewButtonProps,
    ColorPreviewSurfaceProps,
    ColorSwatchProps,
    RadiusPreviewProps,
} from './preview';

export { DesignSystemRoot } from './design-system-root';
export type { DesignSystemRootProps } from './design-system-root';

export {
    formatInrCurrency,
    formatDisplayDate,
    formatIndiaDate,
    formatIndiaDateTime,
    formatIndiaDateWithTime,
    formatIndiaDayMonthTime,
    formatUsLongDate,
    formatUsShortDate,
    formatCurrency,
    formatDate,
    formatNumber,
} from './formatting';
export type {
    FormatInrCurrencyOptions,
    FormatDateOptions,
    FormatCurrencyOptions,
    FormatDateStyleOptions,
    FormatNumberOptions,
} from './formatting';

export {
    letbuyyComponentTokens,
    letbuyyBreakpointTokens,
    letbuyyColorTokens,
    letbuyyDensityCssVariables,
    letbuyyDensityTokens,
    letbuyyPrimitiveTokens,
    letbuyySemanticTokens,
    letbuyyShadowTokens,
    letbuyySurfaceTokens,
    letbuyyTailwindPreset,
    letbuyyTailwindScreens,
    letbuyyTokenCss,
    letbuyyTokenCssVariables,
    letbuyyTokens,
    letbuyyZIndexTokens,
    createLetbuyyBrandVariables,
    validateLetbuyyBrandContrast,
} from './tokens';
export type { LetbuyyBrandContrastCheck, LetbuyyBrandInput, LetbuyyBrandOverrides, LetbuyyDensity, LetbuyySurface, LetbuyyTheme } from './tokens';

export { letbuyyFontCssVariables, letbuyyFontStacks } from './fonts';

export * from './icons';
