import React from 'react';

/**
 * ResponsiveTable - Converts HTML tables to card layout on mobile
 * Usage:
 * <ResponsiveTable columns={['Domain', 'Status', 'Started At', 'Resolved At', '']}>
 *   ... regular table elements ...
 * </ResponsiveTable>
 */
interface ResponsiveTableProps {
  children: React.ReactNode;
  columns?: string[];
  className?: string;
}

export default function ResponsiveTable({ 
  children, 
  columns = [],
  className = '' 
}: ResponsiveTableProps) {
  return (
    <div className={`responsive-table-wrapper overflow-x-auto md:overflow-x-visible ${className}`}>
      <style>{`
        @media (max-width: 767px) {
          .responsive-table-wrapper table {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.5rem;
            border: none;
          }
          
          .responsive-table-wrapper thead {
            display: none;
          }
          
          .responsive-table-wrapper tbody {
            display: contents;
          }
          
          .responsive-table-wrapper tr {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.75rem;
            border: 1px solid hsl(217, 33%, 17%);
            border-radius: 0.5rem;
            padding: 1rem;
            background: hsl(217, 32%, 17%) / 0.5;
            margin-bottom: 0.5rem;
          }
          
          .responsive-table-wrapper td {
            display: grid;
            grid-template-columns: 120px 1fr;
            align-items: start;
            gap: 1rem;
            padding: 0;
            border: none;
            padding-bottom: 0;
          }
          
          .responsive-table-wrapper td::before {
            content: attr(data-label);
            font-weight: 600;
            font-size: 0.75rem;
            color: oklch(70.7% 0.022 261.325);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          
          .responsive-table-wrapper tbody tr:last-child {
            margin-bottom: 0;
          }

          .view-icon {
            display: none !important;
          }
        }
      `}</style>
      <table className="w-full" style={{ borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  );
}

/**
 * Helper to add data-label attributes to table cells
 * Automatically labels cells based on header content
 */
export function TableCell({ 
  label, 
  children, 
  className = '',
  ...props 
}: React.TdHTMLAttributes<HTMLTableCellElement> & { label?: string; children: React.ReactNode }) {
  return (
    <td 
      className={className}
      data-label={label}
      {...props}
    >
      {children}
    </td>
  );
}
