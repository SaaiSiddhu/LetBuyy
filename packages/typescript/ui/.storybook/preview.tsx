import React from 'react';
import { DesignSystemRoot } from '../src/design-system-root';
import '../src/storybook.css';

const preview = {
    decorators: [
        (Story: React.ComponentType) => (
            <DesignSystemRoot surface="admin">
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
