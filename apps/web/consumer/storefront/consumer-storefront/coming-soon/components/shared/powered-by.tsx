interface PoweredByProps {
    isDark?: boolean;
}

export default function PoweredBy({ isDark = true }: PoweredByProps) {
    return (
        <p className="cs-powered" style={{ color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)' }}>
            Powered by{' '}
            <a
                href="https://letbuyy.store"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: isDark ? 'rgba(165,180,252,0.7)' : 'rgba(99,102,241,0.7)' }}
            >
                LetBuyy
            </a>
        </p>
    );
}
