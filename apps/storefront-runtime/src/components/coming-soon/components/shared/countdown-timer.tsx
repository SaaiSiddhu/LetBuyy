'use client';

import { useEffect, useState, useMemo } from 'react';

interface CountdownTimerProps {
    /** Target date (ISO string or Date). Defaults to 14 days from now. */
    targetDate?: string | Date;
    /** Color theme for the numbers */
    accentColor?: string;
    /** Whether currently in dark mode */
    isDark?: boolean;
}

function getTimeLeft(target: Date) {
    const now = new Date().getTime();
    const diff = Math.max(0, target.getTime() - now);
    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
    };
}

export default function CountdownTimer({ targetDate, accentColor = '#6366f1', isDark = true }: CountdownTimerProps) {
    const target = useMemo(() => {
        if (targetDate) return new Date(targetDate);
        const d = new Date();
        d.setDate(d.getDate() + 14);
        return d;
    }, [targetDate]);

    const [time, setTime] = useState(getTimeLeft(target));

    useEffect(() => {
        const interval = setInterval(() => setTime(getTimeLeft(target)), 1000);
        return () => clearInterval(interval);
    }, [target]);

    const items = [
        { value: time.days, label: 'Days' },
        { value: time.hours, label: 'Hours' },
        { value: time.minutes, label: 'Minutes' },
        { value: time.seconds, label: 'Seconds' },
    ];

    return (
        <div className="cs-countdown">
            {items.map((item, i) => (
                <div key={item.label} style={{ display: 'contents' }}>
                    <div className="cs-countdown-item">
                        <div className="cs-countdown-value" style={{ color: accentColor }}>
                            {String(item.value).padStart(2, '0')}
                        </div>
                        <div className="cs-countdown-label">{item.label}</div>
                    </div>
                    {i < 3 && <span className="cs-countdown-sep">:</span>}
                </div>
            ))}
        </div>
    );
}
