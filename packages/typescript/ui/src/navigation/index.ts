// @letbuyy/ui — canonical navigation system.
// Consolidates the design-system shell primitives (AppFrame, Sidebar, Navigation)
// with the data-driven AppNavigation. Apps import these from '@letbuyy/ui'.

export { AppFrame, Navigation, Sidebar, ScrollThumb } from '../app-shell';
export type { AppFrameProps, NavigationItem, NavigationProps, SidebarProps, ScrollThumbProps } from '../app-shell';

export { AppNavigation, isNavItemActive } from './app-navigation';
export type { AppNavigationProps, AppNavigationSection } from './app-navigation';
