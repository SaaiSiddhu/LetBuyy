# Dark mode

One provider owns light/dark/system across every LetBuyy web app: **`LetbuyyThemeProvider`** in `@letbuyy/ui` (`src/theme-provider.tsx`).

## How it works
- **State + persistence:** the provider stores the choice in `localStorage["letbuyy-theme"]` (`light | dark | system`) and resolves `system` against `prefers-color-scheme`.
- **DOM signals:** it sets `<html data-theme="…">` and the `.light`/`.dark` class — both honored by `letbuyyTokenCss`.
- **No cascade conflict:** the provider renders `DesignSystemRoot` with the **resolved** theme (never `auto`), so `@letbuyy/ui` components and app CSS always agree. (This fixes the prior `theme="auto"` vs html-`.dark` override.)
- **No flash:** `<ThemeScript>` in `<head>` applies the resolved theme before paint and caches it on `window.__letbuyyResolvedTheme` so the provider hydrates without a flash. It is the only flash script; apps must not hand-roll one.

## Usage
```tsx
const { theme, resolvedTheme, setTheme, themes } = useTheme();
// a toggle:
<button onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>…</button>
// a tri-state control:
{themes.map(t => <option key={t} value={t}>{t}</option>)}
```

## Per-app defaults
`platform-console` and `platform-operations-portal` default to `dark` (`defaultTheme="dark"`); all other apps default to `system`. All apps support all three choices.

## Don'ts (enforced by `validate:design-system`)
- ❌ `<DesignSystemRoot>` directly in a layout — use `<LetbuyyThemeProvider>`.
- ❌ `theme="auto"`.
- ❌ legacy keys `letbuyy_theme`, `theme`, `theme-marketplace-theme`.
- ❌ a second `ThemeProvider` with its own `createContext`.
