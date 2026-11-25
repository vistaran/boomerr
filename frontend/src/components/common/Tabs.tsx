import React, { useEffect, useLayoutEffect, useRef } from "react";

export type Tab = {
    key: string;
    label: React.ReactNode;
};

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (key: string) => void;
    className?: string;
    rightElement?: React.ReactNode;
    rightElementClassName?: string;
}

export const Tabs: React.FC<TabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
    className = "",
    rightElement,
    rightElementClassName = "",
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const indicatorRef = useRef<HTMLDivElement>(null);
    const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});

    /* -----------------------------
     * Sliding indicator positioning
     * ----------------------------- */
    useLayoutEffect(() => {
        const activeEl = tabRefs.current[activeTab];
        const indicator = indicatorRef.current;
        const container = containerRef.current;

        if (!activeEl || !indicator || !container) return;

        const { offsetLeft, offsetWidth } = activeEl;

        indicator.style.transform = `translateX(${offsetLeft}px)`;
        indicator.style.width = `${offsetWidth}px`;
    }, [activeTab, tabs]);

    /* -----------------------------
     * Mobile swipe support
     * ----------------------------- */
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        let startX = 0;

        const onTouchStart = (e: TouchEvent) => {
            startX = e.touches[0].clientX;
        };

        const onTouchEnd = (e: TouchEvent) => {
            const diff = e.changedTouches[0].clientX - startX;

            if (Math.abs(diff) < 50) return;

            const currentIndex = tabs.findIndex(t => t.key === activeTab);
            if (currentIndex === -1) return;

            if (diff < 0 && currentIndex < tabs.length - 1) {
                onTabChange(tabs[currentIndex + 1].key);
            }

            if (diff > 0 && currentIndex > 0) {
                onTabChange(tabs[currentIndex - 1].key);
            }
        };

        el.addEventListener("touchstart", onTouchStart, { passive: true });
        el.addEventListener("touchend", onTouchEnd);

        return () => {
            el.removeEventListener("touchstart", onTouchStart);
            el.removeEventListener("touchend", onTouchEnd);
        };
    }, [activeTab, tabs, onTabChange]);

    return (
        <div
            ref={containerRef}
            role="tablist"
            className={`
        relative flex justify-between items-center border-b border-slate-800 z-30
        ${className}
      `}
        >
            <div className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.key;

                    return (
                        <div
                            key={tab.key}
                            ref={el => {
                                tabRefs.current[tab.key] = el;
                            }}
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onTabChange(tab.key)}
                            className={`
                                relative pb-3 text-sm font-medium whitespace-nowrap
                                transition-colors duration-200 focus:outline-none
                                focus-visible:outline-none
                                focus-visible:ring-0
                                focus-visible:ring-offset-0 cursor-pointer
                            ${isActive
                                    ? "text-slate-100"
                                    : "text-slate-400 hover:text-slate-200"
                                }`}>
                            {tab.label}
                        </div>
                    );
                })}
            </div>

            {rightElement && (
                <div className={`ml-auto flex items-center pb-2 pl-4 relative z-40 shrink-0 ${rightElementClassName}`}>
                    {rightElement}
                </div>
            )}

            {/* Sliding indicator */}
            <div
                ref={indicatorRef}
                className="
          absolute bottom-0 h-[2px] rounded-full
          bg-sky-500
          transition-all duration-300 ease-out
        "
            />
        </div>
    );
};

export default Tabs;
