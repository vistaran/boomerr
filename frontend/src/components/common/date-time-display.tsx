import React from 'react';

interface DateTimeDisplayProps {
  value?: string | Date | null;
  fallback?: React.ReactNode;
  formatOptions?: Intl.DateTimeFormatOptions;
  className?: string;
}

const defaultFormat: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
};

const DateTimeDisplay: React.FC<DateTimeDisplayProps> = ({
  value,
  fallback = 'Never',
  formatOptions = defaultFormat,
  className = '',
}) => {
  if (!value) return <span className={className}>{fallback}</span>;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(date.getTime())) return <span className={className}>{fallback}</span>;

  const localTime = date.toLocaleString('en-GB', formatOptions);
  const utcTime = date.toLocaleString('en-GB', { ...formatOptions, timeZone: 'UTC' });

  return (
    <span className={className}>
      {localTime}
    </span>
  );
};

export default DateTimeDisplay;
