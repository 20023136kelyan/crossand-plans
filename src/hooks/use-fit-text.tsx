import { MutableRefObject, useLayoutEffect, useState, useRef } from 'react';
import { useEventListener, useResizeObserver, useIsClient } from 'usehooks-ts';

const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 32;

export const useFitText = <T extends HTMLElement>(
    target: MutableRefObject<T | null>,
    text: string | undefined,
    maxSize: number = MAX_FONT_SIZE
) => {
    const isClient = useIsClient();
    const [fontSize, setFontSize] = useState<number>(maxSize);
    const rafRef = useRef<number>();

    const measure = (el: T) => {
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
        }

        rafRef.current = requestAnimationFrame(() => {
            if (el.scrollWidth === 0) return;

            const newSize = Math.max(
                MIN_FONT_SIZE,
                Math.min(
                    maxSize,
                    (el.clientWidth / el.scrollWidth) * maxSize
                )
            );

            if (Math.abs(fontSize - newSize) > 0.5) {
                setFontSize(newSize);
            }
        });
    };

    useLayoutEffect(() => {
        const el = target.current;
        if (!el) return;
        measure(el);
    }, [text, maxSize, target.current]);

    useResizeObserver({
        ref: target,
        onResize: (size) => {
            const el = target.current;
            if (el) measure(el);
        },
    });

    return { fontSize: `${fontSize}px` };
}; 