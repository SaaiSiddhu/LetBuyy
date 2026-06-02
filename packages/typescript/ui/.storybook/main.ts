import tailwindcss from '@tailwindcss/vite';

const config = {
    stories: ['../src/**/*.stories.@(ts|tsx)'],
    framework: {
        name: '@storybook/react-vite',
        options: {},
    },
    docs: {},
    viteFinal: async (viteConfig: { plugins?: unknown[] }) => ({
        ...viteConfig,
        plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
    }),
};

export default config;
