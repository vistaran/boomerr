/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";

function RollingNumber({ value, duration = 400, format = (v: number) => `${v} ms` }: { value: number | null, duration?: number, format?: (v: number) => string }) {
    const [display, setDisplay] = useState(value);
    const raf = useRef<number | null>(null);

    useEffect(() => {
        if (value === null) {
            setDisplay(null);
            return;
        }
        if (display === null) {
            setDisplay(value);
            return;
        }
        const start = display;
        const end = value;
        const startTime = performance.now();
        function animate(now: number) {
            const elapsed = now - startTime;
            if (elapsed >= duration) {
                setDisplay(end);
                return;
            }
            const progress = Math.min(elapsed / duration, 1);
            const current = Math.round(start + (end - start) * progress);
            setDisplay(current);
            raf.current = requestAnimationFrame(animate);
        }
        raf.current = requestAnimationFrame(animate);
        return () => {
            if (raf.current) cancelAnimationFrame(raf.current);
        };
    }, [value]);

    if (display === null) return <span>-</span>;
    return <span>{format(display)}</span>;
}

export default RollingNumber;