import Image from 'next/image';

type RichContentBlock = {
    type?: string;
    level?: number;
    text?: string;
    content?: string;
    items?: string[];
    src?: string;
    alt?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function textFrom(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function stripHtml(value: string): string {
    return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function paragraphNodes(text: string) {
    return text
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
            <p key={index} className="leading-7 text-theme-secondary">
                {paragraph}
            </p>
        ));
}

function renderBlock(block: RichContentBlock, index: number) {
    const content = textFrom(block.text) || textFrom(block.content);

    switch (block.type) {
        case 'heading': {
            const level = Math.min(Math.max(Number(block.level || 2), 2), 4);
            if (level === 4) return <h4 key={index} className="text-lg font-semibold text-theme">{content}</h4>;
            if (level === 3) return <h3 key={index} className="text-xl font-semibold text-theme">{content}</h3>;
            return <h2 key={index} className="text-2xl font-semibold text-theme">{content}</h2>;
        }
        case 'list':
            return (
                <ul key={index} className="list-disc space-y-2 pl-5 text-theme-secondary">
                    {(block.items || []).map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}
                </ul>
            );
        case 'quote':
            return (
                <blockquote key={index} className="border-l-4 pl-4 italic text-theme-secondary">
                    {content}
                </blockquote>
            );
        case 'image':
            if (!block.src || !/^https?:\/\//i.test(block.src)) return null;
            return (
                <div key={index} className="relative my-6 aspect-video overflow-hidden rounded-xl bg-surface">
                    <Image src={block.src} alt={block.alt || ''} fill className="object-cover" />
                </div>
            );
        case 'paragraph':
        default:
            return <p key={index} className="leading-7 text-theme-secondary">{content}</p>;
    }
}

export default function RichContent({ content }: { content: Record<string, unknown> }) {
    const blocks = Array.isArray(content.blocks)
        ? content.blocks.map((block) => asRecord(block) as RichContentBlock)
        : [];

    if (blocks.length > 0) {
        return <div className="space-y-5">{blocks.map(renderBlock)}</div>;
    }

    const body = textFrom(content.body);
    if (body) return <div className="space-y-5">{paragraphNodes(body)}</div>;

    const html = textFrom(content.html);
    if (html) return <div className="space-y-5">{paragraphNodes(stripHtml(html))}</div>;

    return (
        <p className="text-theme-secondary">
            This content has not been published yet.
        </p>
    );
}
