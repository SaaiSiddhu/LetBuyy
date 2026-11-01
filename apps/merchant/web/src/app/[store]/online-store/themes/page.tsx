import { ThemeWorkspace } from '@/components/theme-library/ThemeWorkspace'

export default async function ThemesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
    const { view } = await searchParams
    return <ThemeWorkspace view={view === 'library' ? 'library' : 'overview'} />
}
