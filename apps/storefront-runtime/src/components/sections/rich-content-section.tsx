import RichContent from '@/components/content/rich-content';
import type { SectionModel, ThemeSettings } from '@/types/store';

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function textSetting(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

export default function RichContentSection({
    section,
    theme,
}: {
    section: SectionModel;
    theme: ThemeSettings;
}) {
    const title = textSetting(section.settings.title);
    const configuredContent = asRecord(section.settings.content);
    const body = textSetting(section.settings.body, textSetting(section.settings.html));
    const content = Object.keys(configuredContent).length > 0
        ? configuredContent
        : body
            ? { body }
            : {};

    return (
        <section className="px-4 py-12 md:py-16" style={{ backgroundColor: theme.backgroundColor }}>
            <div className="mx-auto max-w-3xl">
                {title && (
                    <h1 className="mb-8 text-3xl font-bold tracking-normal md:text-4xl" style={{ color: theme.textColor }}>
                        {title}
                    </h1>
                )}
                <RichContent content={content} />
            </div>
        </section>
    );
}
