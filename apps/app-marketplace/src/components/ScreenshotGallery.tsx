'use client';

import { Button, ChevronLeft, ChevronRight, Eye, Modal } from '@letbuyy/ui';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface ScreenshotGalleryProps {
    appName: string;
    screenshots: string[];
}

export function ScreenshotGallery({ appName, screenshots }: ScreenshotGalleryProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const activeScreenshot = activeIndex === null ? null : screenshots[activeIndex] || null;
    const activePosition = activeIndex === null ? 0 : activeIndex + 1;

    useEffect(() => {
        if (activeIndex === null) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setActiveIndex(null);
            if (event.key === 'ArrowLeft') setActiveIndex((current) => current === null ? current : Math.max(0, current - 1));
            if (event.key === 'ArrowRight') setActiveIndex((current) => current === null ? current : Math.min(screenshots.length - 1, current + 1));
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [activeIndex, screenshots.length]);

    return (
        <>
            <div className="app-preview-carousel" aria-label={`${appName} screenshots`}>
                <div className="app-screenshots">
                    {screenshots.map((item, index) => (
                        <figure key={`${item}-${index}`} className="app-screenshot">
                            <Image
                                src={item}
                                alt={`${appName} screenshot ${index + 1}`}
                                width={1120}
                                height={630}
                                sizes="(max-width: 640px) calc(100vw - 48px), 560px"
                            />
                            <figcaption>
                                <span>Preview {index + 1}</span>
                                <Button unstyled type="button" onClick={() => setActiveIndex(index)} aria-label={`Open screenshot ${index + 1} larger`}>
                                    <Eye size={13} aria-hidden="true" />
                                    Open
                                </Button>
                            </figcaption>
                        </figure>
                    ))}
                </div>
                <div className="app-carousel-controls" aria-label="Screenshot navigation">
                    {screenshots.map((item, index) => (
                        <Button
                            unstyled
                            key={`control-${item}-${index}`}
                            type="button"
                            onClick={() => setActiveIndex(index)}
                            aria-label={`Open screenshot ${index + 1}`}
                        >
                            <span>{index + 1}</span>
                        </Button>
                    ))}
                </div>
            </div>

            <Modal
                open={Boolean(activeScreenshot)}
                title={`${appName} screenshot ${activePosition}`}
                description={`${activePosition} of ${screenshots.length}`}
                onClose={() => setActiveIndex(null)}
                className="screenshot-lightbox-modal"
                footer={(
                    <div className="screenshot-lightbox__controls">
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={() => setActiveIndex((current) => current === null ? current : Math.max(0, current - 1))}
                            disabled={activeIndex === 0}
                        >
                            <ChevronLeft size={16} aria-hidden="true" />
                            Previous
                        </Button>
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={() => setActiveIndex((current) => current === null ? current : Math.min(screenshots.length - 1, current + 1))}
                            disabled={activeIndex === screenshots.length - 1}
                        >
                            Next
                            <ChevronRight size={16} aria-hidden="true" />
                        </Button>
                    </div>
                )}
            >
                {activeScreenshot ? (
                    <div className="screenshot-lightbox__image">
                        <Image
                            src={activeScreenshot}
                            alt={`${appName} screenshot ${activePosition}`}
                            width={1440}
                            height={810}
                            sizes="min(96vw, 1200px)"
                            priority
                        />
                    </div>
                ) : null}
            </Modal>
        </>
    );
}
