import React from 'react';
import { DesignSystemRoot } from '../src/design-system-root';
import '../src/storybook.css';

const preview = {
    globalTypes: {
        letbuyyTheme: {
            name: 'Theme',
            defaultValue: 'light',
            toolbar: {
                icon: 'circlehollow',
                items: ['light', 'dark'],
            },
        },
        letbuyyDensity: {
            name: 'Density',
            defaultValue: 'compact',
            toolbar: {
                icon: 'component',
                items: ['compact', 'comfortable', 'spacious'],
            },
        },
    },
    decorators: [
        (Story: React.ComponentType, context: { globals?: { letbuyyTheme?: 'light' | 'dark'; letbuyyDensity?: 'compact' | 'comfortable' | 'spacious' } }) => (
            <DesignSystemRoot
                surface="admin"
                theme={context.globals?.letbuyyTheme ?? 'light'}
                density={context.globals?.letbuyyDensity ?? 'compact'}
            >
                <div className="min-h-screen">
                    <Story />
                </div>
            </DesignSystemRoot>
        ),
    ],
    parameters: {
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
    },
};

export default preview;
