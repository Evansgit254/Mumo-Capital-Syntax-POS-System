import type { Config } from 'tailwindcss';

export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                primary: 'var(--color-primary)',
                secondary: 'var(--color-secondary)',
                tertiary: 'var(--color-tertiary)',
                error: {
                    DEFAULT: 'var(--color-error)',
                    container: 'var(--color-error-container)',
                },
                surface: {
                    DEFAULT: 'var(--surface)',
                    dim: 'var(--surface-dim)',
                    bright: 'var(--surface-bright)',
                    container: {
                        lowest: 'var(--surface-container-lowest)',
                        low: 'var(--surface-container-low)',
                        DEFAULT: 'var(--surface-container)',
                        high: 'var(--surface-container-high)',
                        highest: 'var(--surface-container-highest)',
                    },
                    variant: 'var(--surface-variant)',
                },
                'on-surface': {
                    DEFAULT: 'var(--on-surface)',
                    variant: 'var(--on-surface-variant)',
                },
                outline: {
                    DEFAULT: 'var(--outline)',
                    variant: 'var(--outline-variant)',
                },
                'on-secondary': 'var(--on-secondary)',
                'secondary-container': 'var(--secondary-container)',
                'on-tertiary': 'var(--on-tertiary)',
                'tertiary-container': 'var(--tertiary-container)',
                'on-error-container': 'var(--on-error-container)',
            },
            spacing: {
                xs: 'var(--space-xs)',
                sm: 'var(--space-sm)',
                base: 'var(--space-base)',
                md: 'var(--space-md)',
                lg: 'var(--space-lg)',
                touch: 'var(--space-touch)',
            },
            borderRadius: {
                sm: 'var(--radius-sm)',
                DEFAULT: 'var(--radius)',
                md: 'var(--radius-md)',
                lg: 'var(--radius-lg)',
                xl: 'var(--radius-xl)',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            screens: {
                'tablet': '780px',
            },
        },
    },
    plugins: [],
} satisfies Config;
