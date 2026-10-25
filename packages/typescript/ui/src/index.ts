// @letbuyy/ui — Shared React Components
// These components are designed to work with Tailwind CSS

export { FormProtectionProvider, useFormProtection } from './navigation/form-protection';
export type { FormProtection, RegisterFormProtection } from './navigation/form-protection';

export { Button } from './button';
export type { ButtonProps } from './button';

export { InlineError, Input, NumberField, Textarea } from './input';
export type { InlineErrorProps, InputProps, NumberFieldProps, TextareaProps } from './input';

export { Table } from './table';
export type { TableBulkAction, TableColumn, TableFilterChip, TableProps, TableSavedView } from './table';

export { NavigationLinkProvider } from './navigation/link-provider';
export type { NavigationLinkProviderProps } from './navigation/link-provider';

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
    ProviderModeBadge,
    normalizeProviderMode,
    StatusPresentationBadge,
    toneToVariant,
    EmptyState,
    EmptyStateIllustration,
    SaveBar,
    Skeleton,
    StatusBadge,
    statusToBadgeVariant,
    ToastProvider,
    useToast,
} from './feedback';
export type {
    BadgeProps,
    ProviderMode,
    ProviderModeBadgeProps,
    StatusPresentationBadgeProps,
    StatusPresentationLike,
    StatusToneName,
    StatusBadgeProps,
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

// The same reference-counted lock the overlays use, for app chrome (nav drawers,
// bottom sheets) that opens outside an <Overlay> and must not fight them.
export { acquireScrollLock } from './overlay-hooks';

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

export { AppFrame, Navigation, Sidebar, ScrollThumb, AppNavigation, isNavItemActive } from './navigation';
export type { AppFrameProps, NavigationItem, NavigationProps, SidebarProps, ScrollThumbProps, AppNavigationProps, AppNavigationSection } from './navigation';

export {
    InternalEmptyDataState,
    InternalMetric,
    InternalMetricGrid,
    InternalModuleCard,
    InternalModuleGrid,
    InternalPanel,
    InternalSkipBackendPanel,
    InternalStatusPill,
    InternalWorkspace,
} from './internal-workspace';
export type { InternalMetricProps, InternalModuleCardProps, InternalPanelProps, InternalTone, InternalWorkspaceProps } from './internal-workspace';

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
    LetbuyyThemeProvider,
    ThemeScript,
    useTheme,
    LETBUYY_THEME_STORAGE_KEY,
    LETBUYY_THEME_CHOICES,
} from './theme-provider';
export type {
    LetbuyyThemeChoice,
    LetbuyyResolvedTheme,
    LetbuyyThemeProviderProps,
    ThemeScriptProps,
} from './theme-provider';

export { ThemeToggleButton } from './theme-toggle-button';
export type { ThemeToggleButtonProps } from './theme-toggle-button';

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
