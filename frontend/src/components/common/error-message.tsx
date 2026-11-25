import React from 'react';

interface ErrorMessageProps {
    message?: string;
    className?: string;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message = 'An error occurred.', className = '' }) => (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-rose-100/10 border border-rose-300/20 mb-4">
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-rose-400">
                <circle cx="12" cy="12" r="10" strokeWidth="2.5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5" />
            </svg>
        </div>
        <div className="text-xl font-bold text-rose-400 mb-1">Something went wrong</div>
        <div className="text-base text-slate-400 max-w-md mx-auto">{message}</div>
    </div>
);

export default ErrorMessage;
