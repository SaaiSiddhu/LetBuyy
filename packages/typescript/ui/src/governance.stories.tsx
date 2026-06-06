import React from 'react';
import { Badge, Card, Columns, DesignSystemRoot, Section, Text } from './index';

const meta = {
    title: 'Governance/Usage Guidance',
};

export default meta;

const guidance = [
    {
        title: 'Interactive controls',
        do: 'Use Button, Input, Select, Checkbox, Switch, and Table from @letbuyy/ui.',
        dont: 'Do not ship raw button, input, or table elements in governed app surfaces.',
    },
    {
        title: 'Tokens',
        do: 'Use --lb-* CSS variables, exported token maps, and semantic token names.',
        dont: 'Do not hardcode hex colors or create new duplicate token aliases.',
    },
    {
        title: 'Overlays',
        do: 'Use Modal, Drawer, Popover, Dropdown, Tooltip, and CommandPalette so focus and dismissal stay consistent.',
        dont: 'Do not build one-off overlays without the shared focus-trap, dismiss, and z-index stack.',
    },
    {
        title: 'Deprecations',
        do: 'Migrate deprecated aliases with package codemods, then run API and visual snapshots.',
        dont: 'Do not remove deprecated exports until cross-app migrations have landed.',
    },
];

export function DoAndDontUsage() {
    return (
        <DesignSystemRoot>
            <div className="max-w-5xl space-y-[var(--lb-space-5)] p-[var(--lb-space-5)]">
                <div className="space-y-[var(--lb-space-2)]">
                    <Badge label="Governance" variant="info" />
                    <Text as="h1" variant="heading" reset={false}>
                        @letbuyy/ui usage guardrails
                    </Text>
                    <Text tone="subdued" reset={false}>
                        These notes keep app adoption aligned with the token, accessibility, and compatibility contract.
                    </Text>
                </div>
                <Columns columns={{ base: 1, md: 2 }} gap="4">
                    {guidance.map((item) => (
                        <Card key={item.title}>
                            <Section title={item.title}>
                                <div className="grid gap-[var(--lb-space-3)]">
                                    <div className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-banner-success-border)] bg-[var(--lb-component-banner-success-bg)] p-[var(--lb-space-3)]">
                                        <Text weight="semibold" tone="success" reset={false}>Do</Text>
                                        <Text reset={false}>{item.do}</Text>
                                    </div>
                                    <div className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-banner-danger-border)] bg-[var(--lb-component-banner-danger-bg)] p-[var(--lb-space-3)]">
                                        <Text weight="semibold" tone="critical" reset={false}>Do not</Text>
                                        <Text reset={false}>{item.dont}</Text>
                                    </div>
                                </div>
                            </Section>
                        </Card>
                    ))}
                </Columns>
            </div>
        </DesignSystemRoot>
    );
}
