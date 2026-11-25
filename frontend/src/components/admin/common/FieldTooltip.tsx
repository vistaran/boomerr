import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

export interface FieldTooltipProps {
  title?: string;
  content?: string | React.ReactNode;
  children?: React.ReactNode;
  position?: 'top' | 'top-left' | 'top-right' | 'bottom' | 'bottom-left' | 'bottom-right' | 'left' | 'right';
  className?: string;
  iconClassName?: string;
}

export const FieldTooltip: React.FC<FieldTooltipProps> = ({
  title,
  content,
  children,
  position = 'top',
  className = '',
  iconClassName = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-full left-1/2 -translate-x-1/2 mt-2';
      case 'bottom-left':
        return 'top-full left-0 mt-2';
      case 'bottom-right':
        return 'top-full right-0 mt-2';
      case 'left':
        return 'right-full top-1/2 -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 -translate-y-1/2 ml-2';
      case 'top-left':
        return 'bottom-full left-0 mb-2';
      case 'top-right':
        return 'bottom-full right-0 mb-2';
      case 'top':
      default:
        return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'bottom':
        return '-top-1 left-1/2 -translate-x-1/2 border-t border-l';
      case 'bottom-left':
        return '-top-1 left-3 border-t border-l';
      case 'bottom-right':
        return '-top-1 right-3 border-t border-l';
      case 'left':
        return '-right-1 top-1/2 -translate-y-1/2 border-t border-r';
      case 'right':
        return '-left-1 top-1/2 -translate-y-1/2 border-b border-l';
      case 'top-left':
        return '-bottom-1 left-3 border-b border-r';
      case 'top-right':
        return '-bottom-1 right-3 border-b border-r';
      case 'top':
      default:
        return '-bottom-1 left-1/2 -translate-x-1/2 border-b border-r';
    }
  };

  const bodyContent = content || children;
  if (!bodyContent && !title) return null;

  return (
    <span
      ref={containerRef}
      className={`relative inline-flex items-center align-middle select-none ${className}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-label="Field information"
        tabIndex={-1}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className="inline-flex items-center justify-center p-0.5 text-slate-600 dark:text-slate-400 dark:text-slate-400 hover:text-blue-400 rounded-full transition-colors focus:outline-none"
      >
        <Info className={`w-3.5 h-3.5 transition-transform hover:scale-110 ${iconClassName}`} />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className={`absolute z-50 w-64 max-w-xs p-3 rounded-xl bg-white dark:bg-slate-900/95 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-md transition-all duration-150 text-left cursor-default pointer-events-none normal-case tracking-normal font-normal ${getPositionClasses()}`}
        >
          {/* Arrow */}
          <div
            className={`absolute w-2 h-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/80 rotate-45 ${getArrowClasses()}`}
          />

          {title && (
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-400 uppercase tracking-wider mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
              <span className="truncate">{title}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed break-words font-normal">
            {bodyContent}
          </div>
        </div>
      )}
    </span>
  );
};

export default FieldTooltip;
