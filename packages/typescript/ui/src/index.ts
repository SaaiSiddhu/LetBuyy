// @letbuyy/ui — Shared React Components
// These components are designed to work with Tailwind CSS

export { Button } from './button';
export type { ButtonProps } from './button';

export { InlineError, Input, NumberField, Textarea } from './input';
export type { InlineErrorProps, InputProps, NumberFieldProps, TextareaProps } from './input';

export { DataTable, Badge } from './data-table';
export type { DataTableProps, Column, BadgeProps } from './data-table';

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
    ColumnsProps,
    ContainerProps,
    GridProps,
    InlineStackProps,
    PageContentProps,
    PageHeaderAction,
    PageHeaderActionsProps,
    PageHeaderProps,
    PageIdentity,
    PageProps,
    PageShellProps,
    SectionProps,
    SpaceScale,
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
    TextStyle,
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
    TextStyleProps,
} from './primitives';

export { DesignSystemRoot } from './design-system-root';
export type { DesignSystemRootProps } from './design-system-root';

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
} from './tokens';
export type { LetbuyyBrandInput, LetbuyyBrandOverrides, LetbuyyDensity, LetbuyySurface, LetbuyyTheme } from './tokens';

export { letbuyyFontCssVariables, letbuyyFontStacks } from './fonts';

export * from './icons';
